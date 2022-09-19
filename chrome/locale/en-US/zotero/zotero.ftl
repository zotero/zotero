-app-name = Zotero 

import-wizard =
    .title = "Import"

import-where-from = Where do you want to import from?
import-online-intro-title = Introduction

import-source-file =
    .label = A file (BibTeX, RIS, Zotero RDF, etc.)

import-source-folder =
    .label = A folder of PDFs or other files

import-source-online =
    .label = { $targetApp } online import

import-options = Options
import-importing = Importing…

import-create-collection =
    .label = Place imported collections and items into new collection

import-recreate-structure =
    .label = Recreate folder structure as collections

import-fileTypes-header = File Types to Import:

import-fileTypes-pdf = 
    .label = PDFs

import-fileTypes-other = 
    .placeholder = Other files by pattern, comma-separated (e.g., *.jpg,*.png)

import-file-handling = File Handling
import-file-handling-store = 
    .label = Copy files to the { -app-name } storage folder
import-file-handling-link = 
    .label = Link to files in original location
import-fileHandling-description = Linked files cannot be synced by { -app-name }.

general-error = Error
file-interface-import-error = An error occurred while trying to import the selected file. Please ensure that the file is valid and try again.
file-interface-import-complete = Import Complete
file-interface-items-were-imported = { $numItems ->
    [one] item was imported
    *[other] { $numItems } items were imported
    }

import-mendeley-encrypted = The selected Mendeley database cannot be read, likely because it is encrypted.
                            See <a data-l10n-name="mendeley-import-kb">How do I import a Mendeley library into Zotero?</a> for more information.
                            
file-interface-import-error-translator = An error occurred importing the selected file with “{ $translator }”. Please ensure that the file is valid and try again.

# Variables:
#   $targetAppOnline (String)
#   $targetApp (String)
import-online-intro=In the next step you will be asked to log in to { $targetAppOnline } and grant { -app-name } access. This is necessary to import your { $targetApp } library into { -app-name }.
import-online-intro2={ -app-name } will never see or store your { $targetApp } password.

report-error =
    .label = Report Error…

rtfScan-wizard =
    .title = RTF Scan

rtfScan-introPage-description = Zotero can automatically extract and reformat citations and insert a bibliography into RTF files. To get started, choose an RTF file below.
rtfScan-introPage-description2 = To get started, select an RTF input file and an output file below:

rtfScan-input-file = Input File
rtfScan-output-file = Output File

zotero-file-none-selected =
    .value = No file selected

zotero-file-choose =
    .label = Choose File…

rtfScan-intro-page = 
    .label = Introduction

rtfScan-scan-page =
    .label = Scanning for Citations

rtfScan-scanPage-description = Zotero is scanning your document for citations. Please be patient.

rtfScan-citations-page =
    .label = Verify Cited Items

rtfScan-citations-page-description = Please review the list of recognized citations below to ensure that Zotero has selected the corresponding items correctly. Any unmapped or ambiguous citations must be resolved before proceeding to the next step.

rtfScan-style-page =
    .label = Document Formatting

rtfScan-format-page =
    .label = Formatting Citations

rtfScan-format-page-description = Zotero is processing and formatting your RTF file. Please be patient.

rtfScan-complete-page =
    .label = RTF Scan Complete

rtfScan-complete-page-description = Your document has now been scanned and processed. Please ensure that it is formatted correctly.


bibliography-style-label = Citation Style:
bibliography-locale-label = Language:

integration-prefs-displayAs-label = Display Citations As:
integration-prefs-footnotes = 
    .label = Footnotes
integration-prefs-endnotes =
    .label = Endnotes
