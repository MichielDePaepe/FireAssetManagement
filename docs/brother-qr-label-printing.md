# QR-labels printen met een Brother-labelprinter

Deze notitie beschrijft de aanpak die de Radio Asset Management-app gebruikt
voor QR-labels. De voorbeelden zijn bedoeld als startpunt voor een andere
Python- of Django-app die via het netwerk op een Brother-labelprinter afdrukt.

## Werking in deze app

De afdrukstroom bestaat uit vier stappen:

1. Maak met `qrcode` een QR-code en zet die om naar een Pillow (`PIL.Image`)
   afbeelding. De afbeeldingsgenerator maakt een zwart-wit-RGB-afbeelding.
2. Kies in de applicatie de geconfigureerde printer: model/device, IP-adres en
   backend.
3. Maak een `BrotherLabel`-object uit het pakket `brother-label` en roep
   `print()` aan met het labeltype en een lijst afbeeldingen.
4. Voor meerdere exemplaren herhaal je de afbeelding in die lijst.

De QR-code van een radio bevat in deze app de URL
`https://infoscan.firebru.brussels?data=1,1,<fireplan_id>,1010`. Een radio
zonder Fireplan-ID kan daarom geen QR-label krijgen.

## Dependencies

De gebruikte pakketten zijn vastgelegd in `requirements.txt`:

```text
brother-label==2.0a8
qrcode==8.2
pillow==11.3.0
```

Gebruik in een ander project de versie die daar getest en vastgelegd is. De
Brother-integratie gebruikt `BrotherLabel` uit `brother_label`; QR-afbeeldingen
worden door `qrcode` gemaakt en met Pillow bewerkt.

## Printerconfiguratie

In deze app bevat een printerrecord:

- `device`: Brother-model, bijvoorbeeld `QL-800`;
- `ip`: bereikbaar IP-adres van de printer;
- `backend`: standaard `network`;
- `dpi`: veld in de database, standaard 360.

Bij het afdrukken worden `device`, `ip` en `backend` aan `BrotherLabel`
doorgegeven. Het databaseveld `dpi` wordt in deze code niet aan de
Brother-driver doorgegeven. De QR-generator gebruikt zelf standaard 360 DPI
voor millimeterconversies. Stem resolutie, labelrol en labeltype af op de
Brother-printer en controleer die combinatie met een proefafdruk.

Een minimale printerconfiguratie in Python ziet er zo uit:

```python
from brother_label import BrotherLabel

printer = BrotherLabel(
    device="QL-800",
    target="192.0.2.40",  # vervang door het bereikbare IP-adres
    backend="network",
)
```

`type` is de label-/media-instelling die `brother-label` aan de printerdriver
doorgeeft. De Radio Asset Management-app gebruikt `"18"` voor QR-labels en
`"12"` voor onder meer tekstlabels. Behandel die waarden niet als universeel:
controleer de betekenis voor het gekozen Brother-model, de labelrol en de
versie van de driverbibliotheek.

## QR-afbeelding maken

Voor een QR-label moet de gegevensstring compact zijn. Een QR-code kan ook
rechtstreeks tekst bevatten, maar voor deze toepassing bevat hij een URL.
Onderstaand voorbeeld maakt een zwart-wit-Pillow-afbeelding:

```python
import qrcode
from PIL import Image


def make_qr_image(data: str, size_px: int = 234) -> Image.Image:
    qr = qrcode.QRCode(
        version=4,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,  # quiet zone rondom de code
    )
    qr.add_data(data)
    qr.make(fit=True)

    image = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    return image.resize((size_px, size_px), Image.Resampling.NEAREST)


qr_image = make_qr_image("https://example.org/item/123")
```

De huidige projectimplementatie gebruikt versie 4, foutcorrectie M, een eigen
box size, geen ingebouwde rand en schaalt naar 234 pixels breed/hoog. Voor een
nieuwe implementatie is een witte quiet zone (zoals `border=4`) een goede
uitgangsinstelling. Test de werkelijke afdruk op het gekozen labelmateriaal:
de modules moeten scherp blijven en de scanner moet de code betrouwbaar lezen.

## Afbeelding naar Brother sturen

Dit is de kern van de netwerkafdruk. Geef de Brother-driver een Pillow-image
mee, geen bestandsnaam of PNG-bytes. Gebruik het labeltype dat bij het model
en de rol past.

```python
def print_qr(printer: BrotherLabel, image: Image.Image, copies: int = 1) -> None:
    copies = int(copies)
    if copies < 1:
        raise ValueError("copies moet minstens 1 zijn")

    printer.print(type="18", images=[image] * copies)
```

Voor dit project gebeurt de printerinitialisatie centraal in het model
`Printer`; de applicatieservice bouwt de afbeelding en vraagt het model om af
te drukken:

```python
from brother_label import BrotherLabel


class Printer:
    def __init__(self, device: str, ip: str, backend: str = "network"):
        self.device = device
        self.ip = ip
        self.backend = backend

    def print(self, label_type: str, images, **kwargs):
        brother = BrotherLabel(
            device=self.device,
            target=self.ip,
            backend=self.backend,
        )
        if not isinstance(images, list):
            images = [images]
        return brother.print(type=label_type, images=images, **kwargs)


def print_radio_qr(radio, printer: Printer, copies: int = 1):
    if not radio.fireplan_id:
        raise ValueError("Radio heeft geen Fireplan-ID")

    data = (
        "https://infoscan.firebru.brussels"
        f"?data=1,1,{radio.fireplan_id},1010"
    )
    image = make_qr_image(data)
    return printer.print(label_type="18", images=[image] * int(copies))
```

In de echte Django-app ontvangt `Printer.print(type, images, **kwargs)` een
`type`-argument en maakt het bij elke afdruk een `BrotherLabel`-instantie.
De Radio-appservice maakt de QR-image en roept vervolgens aan:

```python
image = image_generator.qr_image()
printer.print(type="18", images=[image] * int(copies))
```

## Praktische aandachtspunten

- Geef een `PIL.Image` mee in RGB-modus; zwart op wit werkt het meest
  voorspelbaar voor een QR-code.
- Houd een witte marge rond de QR-code. Snijd die niet weg en plaats tekst of
  logo's niet tegen de code aan.
- Print één testlabel en scan het van het uiteindelijke labelmateriaal voordat
  je een batch afdrukt.
- Zet het gewenste aantal exemplaren expliciet in `images`; in de app gebeurt
  dit met `[image] * int(copies)`.
- Behandel verbinding- en driverfouten op de aanroepende servicelaag en geef
  geen succesmelding wanneer `printer.print()` een fout opgooit.
- Voeg tests toe voor afbeeldingsformaat, ontbrekende QR-data en het aantal
  afbeeldingen dat naar `printer.print()` wordt gestuurd. Mock de driver in
  tests zodat geen echte labelprinter nodig is.

## Bronnen in dit project

- `printer/models.py`: printerconfiguratie en adapter naar `BrotherLabel`.
- `radio/services/image_service.py`: QR-URL en afbeeldingsgeneratie.
- `radio/services/printing.py`: QR-printservice, labeltype en kopieën.
- `radio/views.py`: verwerking van de printaanvraag.
