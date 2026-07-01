from apps.core.events.subscriber import subscribe


def listens_to(event):

    def wrapper(handler):

        subscribe(event, handler)

        return handler

    return wrapper
