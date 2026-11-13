from django.urls import path

from . import views

urlpatterns = [
    path("tasks/", views.task_collection, name="task-collection"),
    path("tasks/<str:task_id>/", views.task_detail, name="task-detail"),
    path("tasks/<str:task_id>/events/", views.task_events, name="task-events"),
]
