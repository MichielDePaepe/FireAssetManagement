# Label printer dependencies

The backend pins `brother-label==2.0a8` for PT-P900W network printing. Django renders the text test label as a monochrome raster image with Pillow, and `brother-label` sends that image to the configured printer. The Brother package does not bundle Pillow as a runtime dependency, so both are listed explicitly in `backend/requirements.txt`.

The package metadata identifies `brother-label` as GPLv3-or-later and classifies the 2.0a8 release as a pre-release. Its project page says the API is being reworked and should not be considered stable. PT-P900W is listed as supported, but that status does not mean a user has verified the model. The integration therefore needs a manual proof print on the deployed printer and tape before physical compatibility is treated as confirmed.

## Manual hardware check

- [ ] Pending: print a test label from the deployed application on a PT-P900W and record the printer, tape width, date, and result here.
- Result: not yet checked; automated tests use a mocked driver and do not contact hardware.

Sources:

- [brother-label 2.0a8 on PyPI](https://pypi.org/project/brother-label/2.0a8/)
- [brother-label source repository](https://github.com/fuzeman/brother-label)
