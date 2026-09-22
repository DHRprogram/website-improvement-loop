"""Memory service URL routing."""
from django.urls import path
from .main import store_document, search_documents

urlpatterns = [
    path("", store_document, name="store-doc"),
    path("search", search_documents, name="search-docs"),
]
