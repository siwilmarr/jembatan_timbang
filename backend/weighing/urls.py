from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import WeighingTransactionViewSet, CustomObtainAuthToken

router = DefaultRouter()
router.register(r"weighing", WeighingTransactionViewSet, basename="weighing")

urlpatterns = [
    path("login/", CustomObtainAuthToken.as_view(), name="login"),
] + router.urls
