from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import User


class UserSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    author_id = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "email", "role", "name", "author_id"]

    def get_name(self, user) -> str:
        if hasattr(user, "author"):
            return user.author.name
        return user.get_full_name() or user.email

    def get_author_id(self, user) -> str | None:
        return user.author.author_code if hasattr(user, "author") else None


class LoginSerializer(TokenObtainPairSerializer):
    """Returns tokens plus the user profile, so the frontend can route by role in one call."""

    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data
