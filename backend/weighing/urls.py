from rest_framework.routers import DefaultRouter
from .views import WeighingTransactionViewSet

router = DefaultRouter()
router.register(r"weighing", WeighingTransactionViewSet, basename="weighing")

urlpatterns = router.urls
