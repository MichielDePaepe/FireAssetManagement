from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from citygis.models import Location, Service


class LocationManagementAPITests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.staff = user_model.objects.create_user(
            username="location-staff", password="test-pass", is_staff=True
        )
        self.user = user_model.objects.create_user(username="location-user", password="test-pass")
        self.api = APIClient()
        self.service = Service.objects.create(abbreviation="LOC-A")
        self.other_service = Service.objects.create(abbreviation="LOC-B")
        self.root = Location.objects.create(name="Root", kind=Location.Kind.OTHER)
        self.post = Location.objects.create(
            name="Post A", kind=Location.Kind.POST, parent=self.root, service=self.service
        )
        self.room = Location.objects.create(
            name="Room 1", kind=Location.Kind.ROOM, parent=self.post
        )

    def test_location_management_requires_staff(self):
        self.api.force_login(self.user)

        response = self.api.get(reverse("location-list"))

        self.assertEqual(response.status_code, 403)

    def test_staff_can_list_create_and_update_location_hierarchy(self):
        self.api.force_login(self.staff)

        listing = self.api.get(reverse("location-list"))
        created = self.api.post(
            reverse("location-list"),
            {"name": "New post", "kind": "post", "parent_id": self.root.pk},
            format="json",
        )
        updated = self.api.patch(
            reverse("location-detail", args=[self.root.pk]),
            {"name": "Updated root", "kind": "building"},
            format="json",
        )

        self.assertEqual(listing.status_code, 200)
        self.assertEqual(len(listing.json()), 3)
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.json()["parent_id"], self.root.pk)
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.json()["name"], "Updated root")

    def test_parent_updates_reject_self_and_descendant_cycles(self):
        self.api.force_login(self.staff)

        self_parent = self.api.patch(
            reverse("location-detail", args=[self.post.pk]),
            {"parent_id": self.post.pk},
            format="json",
        )
        descendant_parent = self.api.patch(
            reverse("location-detail", args=[self.root.pk]),
            {"parent_id": self.room.pk},
            format="json",
        )

        self.assertEqual(self_parent.status_code, 400)
        self.assertEqual(descendant_parent.status_code, 400)

    def test_service_mapping_is_only_allowed_for_posts_and_remains_unique(self):
        self.api.force_login(self.staff)

        non_post = self.api.patch(
            reverse("location-detail", args=[self.root.pk]),
            {"service_id": self.other_service.pk},
            format="json",
        )
        duplicate = self.api.post(
            reverse("location-list"),
            {"name": "Post duplicate", "kind": "post", "service_id": self.service.pk},
            format="json",
        )
        another_post = self.api.post(
            reverse("location-list"),
            {"name": "Post B", "kind": "post", "service_id": self.other_service.pk},
            format="json",
        )

        self.assertEqual(non_post.status_code, 400)
        self.assertEqual(duplicate.status_code, 400)
        self.assertEqual(another_post.status_code, 201)
        self.assertEqual(another_post.json()["service_id"], self.other_service.pk)

    def test_delete_is_limited_to_unlinked_leaf_locations(self):
        self.api.force_login(self.staff)
        deletable = Location.objects.create(name="Empty", kind=Location.Kind.OTHER)
        mapped_leaf = Location.objects.create(
            name="Mapped leaf", kind=Location.Kind.POST, service=self.other_service
        )

        blocked_parent = self.api.delete(reverse("location-detail", args=[self.post.pk]))
        blocked_service = self.api.delete(reverse("location-detail", args=[mapped_leaf.pk]))
        deleted = self.api.delete(reverse("location-detail", args=[deletable.pk]))

        self.assertEqual(blocked_parent.status_code, 400)
        self.assertEqual(blocked_service.status_code, 400)
        self.assertEqual(deleted.status_code, 204)
