from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from .builders import ResponseBuilder


class BasePagination(PageNumberPagination):

    page_size = 20
    page_query_param = "page"
    page_size_query_param = "page_size"
    max_page_size = 100

    def get_paginated_response(self, data):
        return Response(
            ResponseBuilder.paginated(
                request=self.request,
                data=data,
                count=self.page.paginator.count,
                page=self.page.number,
                page_size=self.get_page_size(self.request),
                total_pages=self.page.paginator.num_pages,
                next_url=self.get_next_link(),
                previous_url=self.get_previous_link(),
            )
        )
