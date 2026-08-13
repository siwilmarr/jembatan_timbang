from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import (
    WeighingTransactionViewSet,
    CustomObtainAuthToken,
    WarehouseViewSet,
    DestinationViewSet,
    CargoViewSet,
    UserViewSet,
    DatabaseConfigView,
)

router = DefaultRouter()
router.register(r"weighing", WeighingTransactionViewSet, basename="weighing")
router.register(r"warehouses", WarehouseViewSet, basename="warehouse")
router.register(r"destinations", DestinationViewSet, basename="destination")
router.register(r"cargos", CargoViewSet, basename="cargo")
router.register(r"users", UserViewSet, basename="user")

urlpatterns = [
    path("login/", CustomObtainAuthToken.as_view(), name="login"),
    path("db-config/", DatabaseConfigView.as_view(), name="db-config"),
] + router.urls
