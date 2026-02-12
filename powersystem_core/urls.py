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
from rest_framework.routers import DefaultRouter
from api.v1.views.substation import SubstationViewSet
# V1 ViewSets disabled for V2:
# from api.v1.views.load_profile import LoadProfileViewSet
# from api.v1.views.telemetry import TelemetryViewSet
# from api.v1.views.network_topology import NetworkTopologyViewSet
# from api.v1.views.island_detection import IslandDetectionViewSet
from core.views_dev import DatabaseSyncStatusView, DatabaseExportView, DatabaseImportView

router = DefaultRouter()
router.register(r'substations', SubstationViewSet)
# V1 routes disabled for V2:
# router.register(r'load-profiles', LoadProfileViewSet, basename='load-profile')
# router.register(r'telemetry', TelemetryViewSet, basename='telemetry')
# router.register(r'network-topology', NetworkTopologyViewSet, basename='network-topology')
# router.register(r'island-detection', IslandDetectionViewSet, basename='island-detection')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/', include(router.urls)),
    path('api/v1/dev/sync-status/', DatabaseSyncStatusView.as_view(), name='db-sync-status'),
    path('api/v1/dev/export/', DatabaseExportView.as_view(), name='db-export'),
    path('api/v1/dev/import/', DatabaseImportView.as_view(), name='db-import'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
