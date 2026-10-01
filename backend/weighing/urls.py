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
    UnitViewSet,
    CustomerSupplierViewSet,
    WeighingTypeViewSet,
    WeighingScaleViewSet,
    SiteProfileView,
    SiteProfileViewSet,
    PriceListViewSet,
)

router = DefaultRouter()
router.register(r"weighing", WeighingTransactionViewSet, basename="weighing")
router.register(r"warehouses", WarehouseViewSet, basename="warehouse")
router.register(r"destinations", DestinationViewSet, basename="destination")
router.register(r"cargos", CargoViewSet, basename="cargo")
router.register(r"users", UserViewSet, basename="user")
router.register(r"units", UnitViewSet, basename="unit")
router.register(r"customers", CustomerSupplierViewSet, basename="customer")
router.register(r"weighing-types", WeighingTypeViewSet, basename="weighing-type")
router.register(r"scales", WeighingScaleViewSet, basename="scale")
router.register(r"site-profiles", SiteProfileViewSet, basename="site-profile-list")
router.register(r"price-lists", PriceListViewSet, basename="price-list")
router.register(r"price-list", PriceListViewSet, basename="price-list-alt")

urlpatterns = [
    path("login/", CustomObtainAuthToken.as_view(), name="login"),
    path("db-config/", DatabaseConfigView.as_view(), name="db-config"),
    path("site-profile/", SiteProfileView.as_view(), name="site-profile"),
] + router.urls


