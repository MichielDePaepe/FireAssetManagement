import json

from django.contrib.auth import authenticate, login, logout
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST


@require_GET
@ensure_csrf_cookie
def csrf_token(request):
    return JsonResponse({"csrfToken": get_token(request)})


@require_POST
@csrf_protect
def login_view(request):
    try:
        payload = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"detail": "Invalid JSON body."}, status=400)
    user = authenticate(
        request, username=payload.get("username", ""), password=payload.get("password", "")
    )
    if user is None:
        return JsonResponse({"detail": "Invalid username or password."}, status=400)
    login(request, user)
    return JsonResponse({"username": user.get_username()})


@require_POST
@csrf_protect
def logout_view(request):
    logout(request)
    return JsonResponse({"ok": True})


@require_GET
def me_view(request):
    if not request.user.is_authenticated:
        return JsonResponse({"detail": "Authentication credentials were not provided."}, status=401)
    return JsonResponse({"username": request.user.get_username()})
