"""
URL configuration for powersystem_core project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
import os
from rest_framework.routers import DefaultRouter
from api.v1.views.substation import SubstationViewSet
from api.v1.views.load_analytics import LoadAnalyticsViewSet
from api.v1.views.snapshot import SnapshotViewSet
# V1 ViewSets disabled for V2:
# from api.v1.views.load_profile import LoadProfileViewSet
# from api.v1.views.telemetry import TelemetryViewSet
from core.views_dev import DatabaseSyncStatusView, DatabaseExportView, DatabaseImportView

from api.v1.views.topology import TopologyViewSet

router = DefaultRouter()
router.register(r'substations', SubstationViewSet)
router.register(r'load-analytics', LoadAnalyticsViewSet, basename='load-analytics')
router.register(r'snapshots', SnapshotViewSet, basename='snapshot')
router.register(r'topology', TopologyViewSet, basename='topology')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/', include(router.urls)),
]

if settings.DEBUG or os.getenv('DJANGO_ENABLE_DEV_ENDPOINTS', 'False').lower() in {"1", "true", "yes"}:
    urlpatterns += [
        path('api/v1/dev/sync-status/', DatabaseSyncStatusView.as_view(), name='db-sync-status'),
        path('api/v1/dev/export/', DatabaseExportView.as_view(), name='db-export'),
        path('api/v1/dev/import/', DatabaseImportView.as_view(), name='db-import'),
    ]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
