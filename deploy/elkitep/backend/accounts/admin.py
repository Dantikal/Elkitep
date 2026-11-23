from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from rest_framework.authtoken.models import Token
from .models import User, AboutApp, AboutTeamPhoto

@admin.register(User)
class AccountAdmin(UserAdmin):
    list_display = ["email", "study_number", "military_unit", "training_category", "role", "status", "is_active"]
    list_filter = ["status", "is_active", "training_category"]
    search_fields = ["email", "study_number", "military_unit"]
    fieldsets = UserAdmin.fieldsets + (("Өтүнмө", {"fields": ("study_number", "military_unit", "training_category", "role", "photo", "status")}),)
    add_fieldsets = UserAdmin.add_fieldsets + (("Өтүнмө", {"fields": ("email", "study_number", "military_unit", "training_category", "role", "status")}),)
    actions = ["approve", "reject"]
    @admin.action(description="Одобрить выбранные заявки")
    def approve(self, request, queryset):
        queryset.filter(is_superuser=False).update(status="approved", is_active=True)
    @admin.action(description="Отклонить выбранные заявки")
    def reject(self, request, queryset):
        users = queryset.filter(is_superuser=False)
        Token.objects.filter(user__in=users).delete()
        users.update(status="rejected", is_active=False)
    def save_model(self, request, obj, form, change):
        if not obj.is_superuser:
            obj.is_active = obj.status == "approved"
        super().save_model(request, obj, form, change)
        if not obj.is_active:
            Token.objects.filter(user=obj).delete()


class AboutTeamPhotoInline(admin.StackedInline):
    model = AboutTeamPhoto
    extra = 3
    max_num = 3
    fields = ["role", "full_name", "position", "image", "order"]


@admin.register(AboutApp)
class AboutAppAdmin(admin.ModelAdmin):
    inlines = [AboutTeamPhotoInline]
    fields = ["title", "team_title"]

    def has_add_permission(self, request):
        return not AboutApp.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False

from .models import Achievement, AchievementFile


class AchievementFileInline(admin.TabularInline):
    model = AchievementFile
    extra = 0


@admin.register(Achievement)
class AchievementAdmin(admin.ModelAdmin):
    list_display = ["user", "text", "created_at"]
    search_fields = ["user__email", "user__study_number", "text"]
    inlines = [AchievementFileInline]
