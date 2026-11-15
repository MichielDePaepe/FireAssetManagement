from datetime import datetime

from brother_label import BrotherLabel
from django.utils import timezone
from PIL import Image, ImageDraw, ImageFont

from .models import Printer

DPI = 360
MILLIMETERS_PER_INCH = 25.4


def _render_test_label(name: str, printed_at: datetime, tape_width_mm: int) -> Image.Image:
    tape_width_px = round(tape_width_mm * DPI / MILLIMETERS_PER_INCH)
    font_size = min(48, max(12, round(tape_width_px * 0.28)))
    font = ImageFont.load_default(size=font_size)
    lines = _test_label_lines(name, printed_at)

    measure = ImageDraw.Draw(Image.new("1", (1, 1)))
    line_boxes = [measure.textbbox((0, 0), line, font=font) for line in lines]
    margin = max(10, round(tape_width_px * 0.12))
    line_gap = max(4, round(font_size * 0.2))
    content_width = max(box[2] - box[0] for box in line_boxes)
    content_height = sum(box[3] - box[1] for box in line_boxes) + line_gap
    longitudinal_px = content_width + margin * 2
    canvas = Image.new("1", (longitudinal_px, tape_width_px), 1)
    draw = ImageDraw.Draw(canvas)
    y = (tape_width_px - content_height) // 2
    for line, box in zip(lines, line_boxes, strict=True):
        line_height = box[3] - box[1]
        draw.text((margin - box[0], y - box[1]), line, fill=0, font=font)
        y += line_height + line_gap

    # BrotherLabel expects tape width on the image's short axis and label length
    # on its long axis. Rotate the horizontal text before passing it to the driver.
    return canvas.rotate(90, expand=True)


def _test_label_lines(name: str, printed_at: datetime) -> list[str]:
    return [name, printed_at.strftime("%Y-%m-%d %H:%M")]


def print_test_label(printer: Printer) -> None:
    printed_at = timezone.localtime()
    image = _render_test_label(
        printer.name, printed_at, printer.tape_width_mm
    )
    driver = BrotherLabel(
        device=printer.model,
        target=f"tcp://{printer.ip_address}:{printer.port}",
        backend="network",
    )
    driver.print(type=str(printer.tape_width_mm), images=[image])
