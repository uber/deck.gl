import base64
import re

from pydeck.types import String

# See https://github.com/django/django/blob/stable/1.3.x/django/core/validators.py#L45
valid_url_regex = re.compile(
    r"^(?:http|ftp)s?://"
    r"(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+(?:[A-Z]{2,6}\.?|[A-Z0-9-]{2,}\.?)|"
    r"localhost|"
    r"\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})"
    r"(?::\d+)?"
    r"(?:/?|[/?]\S+)$",
    re.IGNORECASE,
)

valid_image_regex = re.compile(
    r".(gif|jpe?g|tiff?|png|webp|bmp)$",
    re.IGNORECASE,
)


ENCODING_PREFIX = "data:image/png;base64,"


class Image:
    def __init__(self, path: str):
        if not self.validate(path):
            raise ValueError(f"{path} is not contain a valid image path")
        self.path = path
        self.is_local = not valid_url_regex.search(self.path)

    def __repr__(self):
        if self.is_local:
            with open(self.path, "rb") as img_file:
                encoded_string = ENCODING_PREFIX + base64.b64encode(img_file.read()).decode("utf-8")
                print(String(encoded_string).__repr__())
                return String(encoded_string).__repr__()
        else:
            return String(self.path).__repr__()

    def __eq__(self, other):
        return str(self) == str(other)

    @staticmethod
    def validate(path):
        # Necessary-but-not-sufficient checks for being a valid image for @deck.gl/json
        return any((valid_image_regex.search(path), valid_url_regex.search(path), path.startswith(ENCODING_PREFIX)))
