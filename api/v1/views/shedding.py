import logging
from rest_framework import viewsets, permissions, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.db import transaction as db_transaction
from api.v1.permissions import IsStaffOrSuperuser, IsSuperuser

logger = logging.getLogger(__name__)

from core.models import (
    LoadSheddingSetting,
    LoadSheddingVersion,
    LoadSheddingStage,
    LoadSheddingTransformerBay,
    LoadSheddingPocketBay,
    LoadSheddingPocketBoundary,
    LoadSheddingAlertConfig,
    LoadSheddingChangeLog,
)
from api.v1.serializers.shedding import (
    LoadSheddingSettingSerializer,
    LoadSheddingVersionSerializer,
    LoadSheddingStageSerializer,
    LoadSheddingStageDetailSerializer,
    LoadSheddingTransformerBaySerializer,
    LoadSheddingPocketBaySerializer,
    LoadSheddingPocketBoundarySerializer,
    LoadSheddingAlertConfigSerializer,
    LoadSheddingChangeLogSerializer,
)

class BaseSheddingViewSet(viewsets.ModelViewSet):
    filter_backends = [filters.SearchFilter]

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.AllowAny()]
        return [IsStaffOrSuperuser()]

class LoadSheddingSettingViewSet(BaseSheddingViewSet):
    queryset = LoadSheddingSetting.objects.all()
    serializer_class = LoadSheddingSettingSerializer

    def get_permissions(self):
        return [IsStaffOrSuperuser()]

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        from core.models import LoadSheddingStageSetting
        if LoadSheddingStageSetting.objects.filter(setting=instance, version__status__in=['active', 'deactivated']).exists():
            return Response({"error": "This setting is in use by a published version and cannot be deleted."}, status=status.HTTP_400_BAD_REQUEST)
        return super().destroy(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        from core.models import LoadSheddingStageSetting
        if LoadSheddingStageSetting.objects.filter(setting=instance, version__status__in=['active', 'deactivated']).exists():
            return Response({"error": "This setting is in use by a published version and cannot be modified."}, status=status.HTTP_400_BAD_REQUEST)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        from core.models import LoadSheddingStageSetting
        if LoadSheddingStageSetting.objects.filter(setting=instance, version__status__in=['active', 'deactivated']).exists():
            return Response({"error": "This setting is in use by a published version and cannot be modified."}, status=status.HTTP_400_BAD_REQUEST)
        return super().partial_update(request, *args, **kwargs)


class LoadSheddingVersionViewSet(BaseSheddingViewSet):
    queryset = LoadSheddingVersion.objects.all()
    serializer_class = LoadSheddingVersionSerializer
    search_fields = ['review_year']

    def get_permissions(self):
        # Public read: viewer and compliance endpoints are accessible to all
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.AllowAny()]
        return [IsStaffOrSuperuser()]

    def get_queryset(self):
        user = self.request.user

        # Superuser sees everything (all drafts + published)
        if user and user.is_authenticated and user.is_superuser:
            return LoadSheddingVersion.objects.all()

        # Staff sees own drafts + null-owner drafts + all published versions.
        # Null-owner drafts exist when a version was created outside a normal request context
        # (e.g. a direct DB seed); without this, staff get 404 trying to delete them.
        if user and user.is_authenticated and user.is_staff:
            from django.db.models import Q
            return LoadSheddingVersion.objects.filter(
                Q(status__in=['active', 'deactivated'])
                | Q(status='draft', created_by=user)
                | Q(status='draft', created_by__isnull=True)
            )

        # Guest / anonymous: published versions only
        return LoadSheddingVersion.objects.filter(status__in=['active', 'deactivated'])

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        # Published versions can only be deleted by superusers
        if instance.status in ['active', 'deactivated'] and not request.user.is_superuser:
            return Response(
                {"error": "Deleting published versions is only allowed for administrators."},
                status=status.HTTP_403_FORBIDDEN
            )
        # Drafts can be deleted by the owner (staff) or any superuser
        if instance.status == 'draft' and instance.created_by != request.user and not request.user.is_superuser:
            return Response(
                {"error": "You can only delete your own drafts."},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['get'], url_path='pre-publish-diff')
    def pre_publish_diff(self, request, pk=None):
        """
        Returns the currently active version ID for the same scheme type.
        The frontend uses this to fetch both versions' stages, build rows,
        and compute the diff before showing the publish reason modal.
        """
        version = self.get_object()
        if version.status != 'draft':
            return Response({"error": "Version is not a draft."}, status=status.HTTP_400_BAD_REQUEST)

        active = LoadSheddingVersion.objects.filter(
            scheme_type=version.scheme_type,
            is_active=True,
        ).exclude(id=version.id).first()

        return Response({
            "active_version_id": str(active.id) if active else None,
            "active_version_label": str(active) if active else None,
            "has_active": active is not None,
        })

    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        version = self.get_object()
        user = request.user
        if not user.is_superuser and version.created_by != user:
            return Response({"error": "You are not authorized to publish this draft."}, status=status.HTTP_403_FORBIDDEN)

        # Validate change reasons when provided
        change_reasons = request.data.get('change_reasons', [])
        compared_to_version_id = request.data.get('compared_to_version_id')

        if change_reasons:
            missing = [i for i, r in enumerate(change_reasons) if not str(r.get('reason', '')).strip()]
            if missing:
                return Response(
                    {"error": "All changed rows must have a reason filled in.", "missing_indices": missing},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # Compute MW cache for all transformer bays before publishing
        from core.models import NetworkSnapshot
        snapshot = NetworkSnapshot.objects.order_by('-timestamp').first()
        if snapshot:
            for stage in version.stages.all():
                for tb in stage.transformer_bays.all():
                    try:
                        tb.compute_mw(snapshot)
                    except Exception as e:
                        import logging
                        logging.getLogger(__name__).warning(f"Failed to compute MW for TB {tb.id}: {e}")
                for pb in stage.pocket_bays.all():
                    try:
                        pb.compute_topology(snapshot)
                    except Exception as e:
                        import logging
                        logging.getLogger(__name__).warning(f"Failed to compute topology for PB {pb.id}: {e}")

        version.publish(user=request.user)

        # Persist change log entries
        if change_reasons:
            compared_to = None
            if compared_to_version_id:
                try:
                    compared_to = LoadSheddingVersion.objects.get(id=compared_to_version_id)
                except LoadSheddingVersion.DoesNotExist:
                    pass
            for entry in change_reasons:
                LoadSheddingChangeLog.objects.create(
                    version=version,
                    compared_to_version=compared_to,
                    change_type=entry.get('change_type', 'new'),
                    substation_id=entry.get('substation_id', ''),
                    substation_name=entry.get('substation_name', ''),
                    feeder=entry.get('feeder', ''),
                    old_stage_label=entry.get('old_stage_label', ''),
                    new_stage_label=entry.get('new_stage_label', ''),
                    reason=str(entry.get('reason', '')).strip(),
                    created_by=user,
                )

        return Response(self.get_serializer(version).data)

    @action(detail=True, methods=['get'], url_path='change-log')
    def change_log(self, request, pk=None):
        """Returns all change log entries recorded when this version was published."""
        version = self.get_object()
        logs = LoadSheddingChangeLog.objects.filter(version=version).select_related(
            'created_by', 'edited_by', 'compared_to_version'
        )
        return Response(LoadSheddingChangeLogSerializer(logs, many=True).data)

    @action(detail=True, methods=['post'], url_path='add-change-log')
    def add_change_log(self, request, pk=None):
        """
        Manually add change log entries for an already-published version.
        Used when a version was published before the changelog feature existed,
        or when entries were not captured at publish time.
        Requires staff or superuser.
        """
        version = self.get_object()
        user = request.user

        if not (user.is_staff or user.is_superuser):
            return Response(
                {"error": "Only staff or superusers can add change log entries."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if version.status not in ['active', 'deactivated']:
            return Response(
                {"error": "Change log entries can only be added to published versions."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        change_reasons = request.data.get('change_reasons', [])
        compared_to_version_id = request.data.get('compared_to_version_id')

        if not change_reasons:
            return Response({"error": "No change reasons provided."}, status=status.HTTP_400_BAD_REQUEST)

        missing = [i for i, r in enumerate(change_reasons) if not str(r.get('reason', '')).strip()]
        if missing:
            return Response(
                {"error": "All changed rows must have a reason filled in.", "missing_indices": missing},
                status=status.HTTP_400_BAD_REQUEST,
            )

        compared_to = None
        if compared_to_version_id:
            try:
                compared_to = LoadSheddingVersion.objects.get(id=compared_to_version_id)
            except LoadSheddingVersion.DoesNotExist:
                pass

        created = []
        for entry in change_reasons:
            log, was_created = LoadSheddingChangeLog.objects.get_or_create(
                version=version,
                substation_id=entry.get('substation_id', ''),
                feeder=entry.get('feeder', ''),
                change_type=entry.get('change_type', 'new'),
                defaults={
                    'compared_to_version': compared_to,
                    'substation_name': entry.get('substation_name', ''),
                    'old_stage_label': entry.get('old_stage_label', ''),
                    'new_stage_label': entry.get('new_stage_label', ''),
                    'reason': str(entry.get('reason', '')).strip(),
                    'created_by': user,
                },
            )
            if was_created:
                created.append(log)

        return Response(
            LoadSheddingChangeLogSerializer(created, many=True).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'])
    def unpublish(self, request, pk=None):
        version = self.get_object()
        user = request.user
        if not user.is_superuser and version.created_by != user:
            return Response({"error": "You are not authorized to unpublish this version."}, status=status.HTTP_403_FORBIDDEN)

        if version.status != 'active' or not version.is_active:
            return Response({"error": "Only the currently active version can be unpublished."}, status=status.HTTP_400_BAD_REQUEST)

        restored_version = version.unpublish()
        return Response({
            "version": self.get_serializer(version).data,
            "restored_version_id": str(restored_version.id) if restored_version else None,
            "restored_version": self.get_serializer(restored_version).data if restored_version else None,
        })

    @action(detail=True, methods=['post'])
    def clone(self, request, pk=None):
        """
        Logic for 'Save as new version'. Clones the version and all its nested stages/bays.
        """
        original = self.get_object()
        
        # Create new version record (auto-increments via model save)
        new_version = LoadSheddingVersion.objects.create(
            scheme_type=original.scheme_type,
            review_year=original.review_year,
            status='draft',
            created_by=request.user if request.user.is_authenticated else None,
            notes=f"Cloned from v{original.version}"
        )
        
        # Clone nested data
        for original_stage in original.stages.all():
            old_stage_id = original_stage.id
            
            # Create new stage
            new_stage = LoadSheddingStage.objects.create(
                version=new_version,
                stage_number=original_stage.stage_number,
                label=original_stage.label
            )
            
            # Clone Settings
            from core.models import LoadSheddingStageSetting
            for ss in LoadSheddingStageSetting.objects.filter(stage_id=old_stage_id):
                LoadSheddingStageSetting.objects.create(
                    stage=new_stage,
                    setting=ss.setting,
                    version=new_version
                )
            
            # Clone Transformer Bays
            for tb in original_stage.transformer_bays.all():
                old_tb_transformers = list(tb.transformers.all())
                new_tb = LoadSheddingTransformerBay.objects.create(
                    stage=new_stage,
                    relay=tb.relay
                )
                new_tb.transformers.set(old_tb_transformers)
            
            # Clone Pocket Bays
            for pb in original_stage.pocket_bays.all():
                old_pb_id = pb.id
                new_pb = LoadSheddingPocketBay.objects.create(
                    stage=new_stage,
                    topology_cache=pb.topology_cache,
                    topology_valid=pb.topology_valid,
                    topology_alert=pb.topology_alert,
                    manual_substations=pb.manual_substations or [],
                )
                
                from core.models import LoadSheddingPocketBoundary
                for boundary in LoadSheddingPocketBoundary.objects.filter(pocket_id=old_pb_id):
                    old_branches = list(boundary.branches.all())
                    new_boundary = LoadSheddingPocketBoundary.objects.create(
                        pocket=new_pb,
                        relay=boundary.relay
                    )
                    new_boundary.branches.set(old_branches)

        return Response(self.get_serializer(new_version).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='bulk-save-stages')
    def bulk_save_stages(self, request, pk=None):
        """
        Single-request save of all stages for a draft version.
        Replaces the ~100-request sequential save flow with one atomic write + post-commit compute.

        Payload:
        {
          "stages": [{
            "stage_number": 1, "label": "Stage 1", "target_mw": 0, "setting_ids": [...],
            "transformer_bays": [{"relay": "<id>", "transformers": ["<id>", ...]}],
            "computed_pockets": [{
              "relay_groups": [{"relay": "<id>", "branches": ["<id>", ...]}]
            }]
          }]
        }
        Returns: LoadSheddingStageDetailSerializer list (same shape as ?include_bays=true).
        """
        from core.models import (
            LoadSheddingStage, LoadSheddingStageSetting, LoadSheddingSetting,
            LoadSheddingTransformerBay, LoadSheddingPocketBay, LoadSheddingPocketBoundary,
            LoadSheddingRelay, LoadTransformer, IncomingBranch, NetworkSnapshot,
        )
        from api.v1.serializers.shedding import LoadSheddingStageDetailSerializer

        version = self.get_object()
        if version.status != 'draft':
            return Response({"error": "Only draft versions can be bulk-saved."}, status=status.HTTP_400_BAD_REQUEST)

        stages_data = request.data.get('stages', [])
        created_tbs = []  # compute_mw after commit
        created_pbs = []  # compute_topology after commit

        with db_transaction.atomic():
            version.stages.all().delete()

            for sdata in stages_data:
                stage = LoadSheddingStage.objects.create(
                    version=version,
                    stage_number=sdata['stage_number'],
                    label=sdata.get('label', ''),
                    target_mw=sdata.get('target_mw') or 0,
                )

                for idx, sid in enumerate(sdata.get('setting_ids') or []):
                    sid = str(sid) if not isinstance(sid, str) else sid
                    try:
                        setting = LoadSheddingSetting.objects.get(id=sid)
                        LoadSheddingStageSetting.objects.create(
                            stage=stage, setting=setting, version=version, order=idx
                        )
                    except LoadSheddingSetting.DoesNotExist:
                        logger.warning("bulk_save_stages: setting %s not found, skipped", sid)

                for tb_data in sdata.get('transformer_bays') or []:
                    tx_ids = [
                        t if isinstance(t, (str, int)) else t.get('id')
                        for t in (tb_data.get('transformers') or [])
                    ]
                    tx_ids = [t for t in tx_ids if t]
                    if not tx_ids:
                        continue
                    try:
                        relay = LoadSheddingRelay.objects.select_related('substation').get(
                            id=tb_data.get('relay')
                        )
                    except LoadSheddingRelay.DoesNotExist:
                        logger.warning("bulk_save_stages: relay %s not found, skipped", tb_data.get('relay'))
                        continue

                    tb = LoadSheddingTransformerBay.objects.create(stage=stage, relay=relay)
                    tb.transformers.set(LoadTransformer.objects.filter(id__in=tx_ids))

                    # Replicate LoadSheddingTransformerBaySerializer._freeze_metadata exactly
                    tb.frozen_relay_name = relay.relay_name or ''
                    sub = relay.substation
                    if sub:
                        tb.frozen_substation_id = sub.substation_id
                        tb.frozen_substation_name = sub.name
                    assets = []
                    for bid in tb.transformers.values_list('bay_id', flat=True):
                        parts = str(bid).split('_', 1)
                        assets.append(parts[1] if len(parts) > 1 else bid)
                    tb.frozen_assets = assets
                    tb.save(update_fields=[
                        'frozen_relay_name', 'frozen_substation_id',
                        'frozen_substation_name', 'frozen_assets',
                    ])
                    created_tbs.append(tb)

                for pocket_data in sdata.get('computed_pockets') or []:
                    relay_groups = pocket_data.get('relay_groups') or []
                    manual_subs = pocket_data.get('manual_substations') or []
                    if not relay_groups and not manual_subs:
                        continue  # skip empty ghost pockets
                    pb = LoadSheddingPocketBay.objects.create(
                        stage=stage,
                        manual_substations=manual_subs,
                    )
                    has_boundaries = False

                    for rg in relay_groups:
                        branch_ids = rg.get('branches') or []
                        if not branch_ids:
                            continue
                        try:
                            relay = LoadSheddingRelay.objects.select_related('substation').get(
                                id=rg.get('relay')
                            )
                        except LoadSheddingRelay.DoesNotExist:
                            logger.warning("bulk_save_stages: relay %s not found for pocket boundary", rg.get('relay'))
                            continue

                        boundary = LoadSheddingPocketBoundary.objects.create(pocket=pb, relay=relay)
                        branches = list(
                            IncomingBranch.objects.select_related('substation', 'to_substation')
                            .filter(id__in=branch_ids)
                        )
                        boundary.branches.set(branches)

                        # Replicate LoadSheddingPocketBoundarySerializer._freeze_metadata exactly
                        boundary.frozen_relay_name = relay.relay_name or ''
                        sub = relay.substation
                        if sub:
                            boundary.frozen_substation_id = sub.substation_id
                            boundary.frozen_substation_name = sub.name
                        boundary.frozen_assets = [
                            {
                                'from_sub': b.substation.substation_id if b.substation else '',
                                'to_sub': b.to_substation.substation_id if b.to_substation else '',
                                'ckt_id': b.ckt_id,
                            }
                            for b in branches
                        ]
                        boundary.save(update_fields=[
                            'frozen_relay_name', 'frozen_substation_id',
                            'frozen_substation_name', 'frozen_assets',
                        ])
                        has_boundaries = True

                    if has_boundaries or pb.manual_substations:
                        created_pbs.append(pb)

        # Rule 3 server-side validation: no substation can appear as both a direct bay and a pocket substation
        # within the same version (version-wide, all stages).
        direct_sub_ids = set()
        pocket_sub_ids = set()
        for sdata in stages_data:
            for tb_data in sdata.get('transformer_bays') or []:
                try:
                    relay = LoadSheddingRelay.objects.select_related('substation').get(id=tb_data.get('relay'))
                    if relay.substation:
                        direct_sub_ids.add(relay.substation.substation_id)
                except LoadSheddingRelay.DoesNotExist:
                    pass
            for pocket_data in sdata.get('computed_pockets') or []:
                pocket_sub_ids.update(pocket_data.get('manual_substations') or [])
        overlap = direct_sub_ids & pocket_sub_ids
        if overlap:
            return Response(
                {
                    'error': 'Rule 3 violation: the following substations appear as both a direct bay and a manual pocket substation: '
                             + ', '.join(sorted(overlap))
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Compute MW and topology outside the atomic block so exceptions don't mask writes
        snapshot = NetworkSnapshot.objects.order_by('-timestamp').first()
        if snapshot:
            for tb in created_tbs:
                try:
                    tb.compute_mw(snapshot)
                except Exception as e:
                    logger.warning("bulk_save_stages: compute_mw failed for TB %s: %s", tb.id, e)
            for pb in created_pbs:
                try:
                    pb.compute_topology(snapshot)  # respects manual_substations internally
                except Exception as e:
                    logger.warning("bulk_save_stages: compute_topology failed for PB %s: %s", pb.id, e)

        stages = (
            version.stages
            .prefetch_related(
                'transformer_bays__relay__substation',
                'transformer_bays__transformers',
                'pocket_bays__boundaries__relay__substation',
                'pocket_bays__boundaries__branches',
                'loadsheddingstagesetting_set__setting',
            )
            .order_by('stage_number')
        )
        return Response(LoadSheddingStageDetailSerializer(stages, many=True).data)

    @action(detail=False, methods=['get'], url_path='active-protected-bays')
    def active_protected_bays(self, request):
        """
        GET /api/v1/load-shedding-versions/active-protected-bays/?designing=<UFLS|UVLS|EMLS>

        Rule 1 is bidirectional:
          - designing=UFLS  → returns bays from published UVLS + EMLS (any stage)
          - designing=UVLS/EMLS → returns bays from published UFLS protected stages only
        """
        designing = request.query_params.get('designing', 'UVLS').upper()

        if designing == 'UFLS':
            # Designing UFLS: conflict set = all bays in published UVLS + EMLS
            conflict_ids = set()
            conflict_info = {}
            for scheme in ['UVLS', 'EMLS']:
                version = LoadSheddingVersion.objects.filter(
                    scheme_type=scheme, is_active=True, status='active'
                ).first()
                if version:
                    subs = list(
                        LoadSheddingTransformerBay.objects
                        .filter(stage__version=version)
                        .values_list('relay__substation__substation_id', flat=True)
                        .distinct()
                    )
                    conflict_ids.update(subs)
                    conflict_info[scheme] = {'version_id': str(version.id), 'substation_ids': subs}

            return Response({
                'designing': designing,
                'conflict_substation_ids': list(conflict_ids),
                'conflict_info': conflict_info,
                # Keep naming consistent with UVLS/EMLS path so frontend can use same field
                'protected_stage_numbers': None,
            })

        else:
            # Designing UVLS or EMLS: conflict set = UFLS published protected stages
            ufls_version = LoadSheddingVersion.objects.filter(
                scheme_type='UFLS', is_active=True, status='active'
            ).first()

            if not ufls_version:
                return Response({
                    'designing': designing,
                    'conflict_substation_ids': [],
                    'protected_stage_numbers': [],
                    'version_id': None,
                })

            try:
                config = LoadSheddingAlertConfig.objects.get(scheme_type='UFLS')
                protected_stage_numbers = config.ufls_protected_stages or []
            except LoadSheddingAlertConfig.DoesNotExist:
                protected_stage_numbers = [1, 2, 3]

            protected_stages = ufls_version.stages.filter(stage_number__in=protected_stage_numbers)

            conflict_ids = set()
            stage_bay_map = {}
            for stage in protected_stages:
                subs = list(
                    stage.transformer_bays
                    .values_list('relay__substation__substation_id', flat=True)
                    .distinct()
                )
                conflict_ids.update(subs)
                stage_bay_map[stage.stage_number] = subs

            return Response({
                'designing': designing,
                'version_id': str(ufls_version.id),
                'protected_stage_numbers': protected_stage_numbers,
                'conflict_substation_ids': list(conflict_ids),
                'stage_bay_map': stage_bay_map,
            })

    @action(detail=False, methods=['get'], url_path='compliance-report')
    def compliance_report(self, request):
        """
        GET /api/v1/load-shedding-versions/compliance-report/?scheme_type=UFLS|UVLS|EMLS
        Scheme-scoped compliance report for the Alert Report tab.

        The subject scheme is the one passed via ?scheme_type.
        Rule 1:
          - Subject=UFLS → check UFLS protected stages vs published UVLS/EMLS (any stage)
          - Subject=UVLS/EMLS → check subject's bays (any stage) vs published UFLS protected stages
        Rule 2:
          - Check subject scheme only: critical substations in its restricted stages
        """
        from core.models import CriticalAsset

        subject = request.query_params.get('scheme_type', '').upper()
        if subject not in ('UFLS', 'UVLS', 'EMLS'):
            return Response({'error': 'scheme_type must be UFLS, UVLS, or EMLS'}, status=400)

        # Fetch all active published versions
        active_versions = {
            v.scheme_type: v
            for v in LoadSheddingVersion.objects.filter(is_active=True, status='active')
        }

        subject_version = active_versions.get(subject)
        if not subject_version:
            return Response({
                'subject': subject,
                'active_versions': {},
                'protected_stage_numbers': [],
                'rule1_violations': [],
                'rule2_violations': [],
                'summary': {'rule1_count': 0, 'rule2_count': 0, 'total': 0},
            })

        # Fetch alert configs
        LoadSheddingAlertConfig.get_or_create_defaults()
        configs = {c.scheme_type: c for c in LoadSheddingAlertConfig.objects.all()}

        # Fetch critical asset substation IDs
        critical_sub_ids = set(
            CriticalAsset.objects.values_list('substation__substation_id', flat=True).distinct()
        )

        def get_sub_stage_map(version):
            mapping = {}
            for stage in version.stages.prefetch_related('transformer_bays__relay__substation').all():
                for bay in stage.transformer_bays.all():
                    sub_id = bay.relay.substation.substation_id if bay.relay and bay.relay.substation else None
                    if sub_id:
                        mapping.setdefault(sub_id, []).append({
                            'stage_number': stage.stage_number,
                            'stage_label': stage.label,
                        })
            return mapping

        ufls_config = configs.get('UFLS')
        protected_stage_numbers = set(ufls_config.ufls_protected_stages or []) if ufls_config else {1, 2, 3}

        # --- Rule 1 ---
        rule1_violations = []

        if subject == 'UFLS':
            # Subject is UFLS: check UFLS protected stages vs UVLS/EMLS
            subject_map = get_sub_stage_map(subject_version)
            for sub_id, stages in subject_map.items():
                protected = [s for s in stages if s['stage_number'] in protected_stage_numbers]
                if not protected:
                    continue
                conflicting_schemes = {}
                for other in ['UVLS', 'EMLS']:
                    if other in active_versions:
                        other_map = get_sub_stage_map(active_versions[other])
                        if sub_id in other_map:
                            conflicting_schemes[other] = {
                                'version_label': f"{active_versions[other].scheme_type} {active_versions[other].review_year} v{active_versions[other].version}",
                                'stages': other_map[sub_id],
                            }
                if conflicting_schemes:
                    rule1_violations.append({
                        'substation_id': sub_id,
                        'subject_stages': protected,
                        'conflicting_schemes': conflicting_schemes,
                    })
        else:
            # Subject is UVLS or EMLS: check subject's bays vs UFLS protected stages
            if 'UFLS' in active_versions:
                ufls_map = get_sub_stage_map(active_versions['UFLS'])
                protected_subs = {
                    sub_id: [s for s in stages if s['stage_number'] in protected_stage_numbers]
                    for sub_id, stages in ufls_map.items()
                    if any(s['stage_number'] in protected_stage_numbers for s in stages)
                }
                subject_map = get_sub_stage_map(subject_version)
                for sub_id, stages in subject_map.items():
                    if sub_id in protected_subs:
                        rule1_violations.append({
                            'substation_id': sub_id,
                            'subject_stages': stages,
                            'conflicting_schemes': {
                                'UFLS': {
                                    'version_label': f"UFLS {active_versions['UFLS'].review_year} v{active_versions['UFLS'].version}",
                                    'stages': protected_subs[sub_id],
                                }
                            },
                        })

        # --- Rule 2: subject scheme only ---
        rule2_violations = []
        cfg = configs.get(subject)
        restricted = set(cfg.critical_restricted_stages or []) if cfg else set()
        subject_map = get_sub_stage_map(subject_version)
        for sub_id, stages in subject_map.items():
            if sub_id not in critical_sub_ids:
                continue
            violating = [s for s in stages if s['stage_number'] in restricted]
            if violating:
                rule2_violations.append({
                    'substation_id': sub_id,
                    'stages': violating,
                })

        # --- Rule 3: Direct bay / pocket substation overlap — version-wide, same scheme ---
        rule3_violations = []
        # Build direct bay map: substation_id → [stage info]
        direct_bay_map = {}
        for stage in subject_version.stages.prefetch_related('transformer_bays__relay__substation').all():
            for bay in stage.transformer_bays.all():
                sub_id = bay.relay.substation.substation_id if bay.relay and bay.relay.substation else None
                if sub_id:
                    direct_bay_map.setdefault(sub_id, []).append({
                        'stage_number': stage.stage_number,
                        'stage_label': stage.label,
                    })

        # Build pocket substation map: substation_id → [stage info]
        pocket_sub_map = {}
        for stage in subject_version.stages.prefetch_related('pocket_bays').all():
            for pb in stage.pocket_bays.all():
                cache = pb.topology_cache or {}
                isolated = cache.get('isolated_substations', [])
                manual = pb.manual_substations or []
                for sub_id in set(isolated) | set(manual):
                    if sub_id:
                        info = {'stage_number': stage.stage_number, 'stage_label': stage.label}
                        existing = pocket_sub_map.setdefault(sub_id, [])
                        if not any(e['stage_number'] == stage.stage_number for e in existing):
                            existing.append(info)

        for sub_id, direct_stages in direct_bay_map.items():
            if sub_id in pocket_sub_map:
                rule3_violations.append({
                    'substation_id': sub_id,
                    'direct_stages': direct_stages,
                    'pocket_stages': pocket_sub_map[sub_id],
                })

        active_version_info = {
            scheme: {
                'version_id': str(v.id),
                'label': f"{v.scheme_type} {v.review_year} v{v.version}",
            }
            for scheme, v in active_versions.items()
        }

        return Response({
            'subject': subject,
            'active_versions': active_version_info,
            'protected_stage_numbers': sorted(protected_stage_numbers),
            'rule1_violations': rule1_violations,
            'rule2_violations': rule2_violations,
            'rule3_violations': rule3_violations,
            'summary': {
                'rule1_count': len(rule1_violations),
                'rule2_count': len(rule2_violations),
                'rule3_count': len(rule3_violations),
                'total': len(rule1_violations) + len(rule2_violations) + len(rule3_violations),
            },
        })


class LoadSheddingStageViewSet(BaseSheddingViewSet):
    queryset = LoadSheddingStage.objects.all()
    serializer_class = LoadSheddingStageSerializer
    search_fields = ['label']

    def get_serializer_class(self):
        if self.action == 'retrieve' or self.request.query_params.get('include_bays') == 'true':
            return LoadSheddingStageDetailSerializer
        return LoadSheddingStageSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        version = self.request.query_params.get('version')
        if version:
            queryset = queryset.filter(version_id=version)
        return queryset


class LoadSheddingTransformerBayViewSet(BaseSheddingViewSet):
    queryset = LoadSheddingTransformerBay.objects.all()
    serializer_class = LoadSheddingTransformerBaySerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        stage = self.request.query_params.get('stage')
        relay = self.request.query_params.get('relay')
        if stage:
            queryset = queryset.filter(stage_id=stage)
        if relay:
            queryset = queryset.filter(relay_id=relay)
        return queryset

    @action(detail=False, methods=['post'])
    def recompute(self, request):
        """
        Recompute mw_cache for transformer bays.
        POST /api/v1/load-shedding-transformer-bays/recompute/
        Body: { "version_id": "uuid" } (optional: recompute all bays in a version)
        """
        from core.models import NetworkSnapshot
        snapshot = NetworkSnapshot.objects.order_by('-timestamp').first()
        if not snapshot:
            return Response({'error': 'No snapshot found'}, status=404)

        version_id = request.data.get('version_id')
        queryset = self.get_queryset()
        if version_id:
            queryset = queryset.filter(stage__version_id=version_id)

        results = []
        for tb in queryset:
            try:
                mw = tb.compute_mw(snapshot)
                results.append({'id': str(tb.id), 'status': 'success', 'mw': mw})
            except Exception as e:
                results.append({'id': str(tb.id), 'status': 'error', 'error': str(e)})

        return Response({
            'snapshot_id': str(snapshot.id),
            'recomputed_count': len(results),
            'results': results,
        })


class LoadSheddingPocketBayViewSet(BaseSheddingViewSet):
    queryset = LoadSheddingPocketBay.objects.all()
    serializer_class = LoadSheddingPocketBaySerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        stage = self.request.query_params.get('stage')
        if stage:
            queryset = queryset.filter(stage_id=stage)
        return queryset

    @action(detail=True, methods=['patch'], url_path='manual-override')
    def manual_override(self, request, pk=None):
        """
        Set or clear the manual substation override for a pocket bay.
        PATCH /api/v1/load-shedding-pocket-bays/{id}/manual-override/
        Body: { "manual_substations": ["SUB1", "SUB2", ...] }
              (empty list clears the override and restores topology-based computation)
        Returns: updated LoadSheddingPocketBaySerializer data.
        """
        from core.models import NetworkSnapshot, Substation
        from api.v1.serializers.shedding import LoadSheddingPocketBaySerializer

        pocket = self.get_object()
        if pocket.stage.version.status != 'draft':
            return Response(
                {"error": "Manual override can only be set on draft versions."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        raw_ids = request.data.get('manual_substations', [])
        if not isinstance(raw_ids, list):
            return Response({"error": "manual_substations must be a list."}, status=status.HTTP_400_BAD_REQUEST)

        # Validate all provided IDs exist
        if raw_ids:
            existing = set(Substation.objects.filter(substation_id__in=raw_ids).values_list('substation_id', flat=True))
            unknown = [s for s in raw_ids if s not in existing]
            if unknown:
                return Response({"error": f"Unknown substation IDs: {unknown}"}, status=status.HTTP_400_BAD_REQUEST)

        pocket.manual_substations = raw_ids
        pocket.save(update_fields=['manual_substations'])

        snapshot = NetworkSnapshot.objects.order_by('-timestamp').first()
        if snapshot:
            try:
                pocket.compute_topology(snapshot)
            except Exception as e:
                logger.warning("manual_override: compute_topology failed for PB %s: %s", pocket.id, e)

        pocket.refresh_from_db()
        return Response(LoadSheddingPocketBaySerializer(pocket).data)

    @action(detail=False, methods=['get'], url_path='substation-mw')
    def substation_mw(self, request):
        """
        GET /api/v1/load-shedding-pocket-bays/substation-mw/
        Returns all substations with their current MW load from the latest snapshot.
        Used to populate the manual island override picker.
        """
        from core.models import NetworkSnapshot, Substation
        from services.topology_service import TopologyService

        snapshot = NetworkSnapshot.objects.order_by('-timestamp').first()
        mw_map = {}
        if snapshot:
            try:
                service = TopologyService(snapshot)
                load_map = service.get_load_transformers_by_substation()
                mw_map = {sub_id: data.get('total_p_mw', 0.0) for sub_id, data in load_map.items()}
            except Exception as e:
                logger.warning("substation_mw: failed to load topology data: %s", e)

        substations = Substation.objects.values('substation_id', 'name', 'voltage').order_by('substation_id')
        result = [
            {
                'substation_id': s['substation_id'],
                'name': s['name'],
                'voltage': s['voltage'],
                'mw': round(mw_map.get(s['substation_id'], 0.0), 2),
            }
            for s in substations
        ]
        return Response(result)

    @action(detail=False, methods=['post'])
    def recompute(self, request):
        """
        Recompute topology_cache for pocket bays.
        POST /api/v1/load-shedding-pocket-bays/recompute/
        Body: { "snapshot_id": "uuid" } (optional, uses active snapshot if not provided)
        """
        from core.models import NetworkSnapshot
        snapshot_id = request.data.get('snapshot_id')
        
        if snapshot_id:
            snapshot = NetworkSnapshot.objects.filter(id=snapshot_id).first()
        else:
            snapshot = NetworkSnapshot.objects.order_by('-timestamp').first()
        
        if not snapshot:
            return Response({'error': 'No snapshot found'}, status=404)
        
        pocket_ids = request.data.get('pocket_ids')  # Optional: specific pocket IDs
        queryset = self.get_queryset()
        if pocket_ids:
            queryset = queryset.filter(id__in=pocket_ids)
        
        results = []
        for pocket in queryset:
            try:
                cache = pocket.compute_topology(snapshot)
                results.append({
                    'id': str(pocket.id),
                    'status': 'success',
                    'mw': cache.get('mw'),
                    'substations': cache.get('isolated_substations', []),
                    'substation_mw': cache.get('substation_mw', {}),
                })
            except Exception as e:
                results.append({
                    'id': str(pocket.id),
                    'status': 'error',
                    'error': str(e),
                })
        
        return Response({
            'snapshot_id': str(snapshot.id),
            'recomputed_count': len(results),
            'results': results,
        })


class LoadSheddingPocketBoundaryViewSet(BaseSheddingViewSet):
    queryset = LoadSheddingPocketBoundary.objects.all()
    serializer_class = LoadSheddingPocketBoundarySerializer


class LoadSheddingAlertConfigViewSet(BaseSheddingViewSet):
    """
    CRUD for per-scheme alert rule configuration.
    GET  /api/v1/load-shedding-alert-configs/           → list all (auto-creates defaults)
    GET  /api/v1/load-shedding-alert-configs/{id}/      → single config
    PATCH /api/v1/load-shedding-alert-configs/{id}/     → update config
    """
    serializer_class = LoadSheddingAlertConfigSerializer
    http_method_names = ['get', 'patch', 'head', 'options']

    def get_permissions(self):
        return [IsStaffOrSuperuser()]

    def get_queryset(self):
        LoadSheddingAlertConfig.get_or_create_defaults()
        return LoadSheddingAlertConfig.objects.all().order_by('scheme_type')

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save(updated_by=request.user)
        return Response(serializer.data)


class LoadSheddingChangeLogViewSet(viewsets.GenericViewSet,
                                   viewsets.mixins.ListModelMixin,
                                   viewsets.mixins.RetrieveModelMixin,
                                   viewsets.mixins.UpdateModelMixin):
    """
    Read-only for staff/viewers. Only superusers may PATCH the reason field.
    """
    serializer_class = LoadSheddingChangeLogSerializer
    http_method_names = ['get', 'patch', 'head', 'options']

    def get_queryset(self):
        qs = LoadSheddingChangeLog.objects.select_related(
            'version', 'compared_to_version', 'created_by', 'edited_by'
        )
        version_id = self.request.query_params.get('version')
        if version_id:
            qs = qs.filter(version_id=version_id)
        return qs

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.AllowAny()]
        return [IsSuperuser()]

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        reason = str(request.data.get('reason', '')).strip()
        if not reason:
            return Response({"error": "Reason cannot be empty."}, status=status.HTTP_400_BAD_REQUEST)
        if len(reason) > 200:
            return Response({"error": "Reason must be 200 characters or less."}, status=status.HTTP_400_BAD_REQUEST)
        instance.reason = reason
        instance.edited_at = timezone.now()
        instance.edited_by = request.user
        instance.save(update_fields=['reason', 'edited_at', 'edited_by'])
        return Response(LoadSheddingChangeLogSerializer(instance).data)
