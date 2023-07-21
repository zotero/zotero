import-window =
    .title = Import

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
import-online-new =
    .label = Download new items only; don’t update previously imported items
import-mendeley-username = Username
import-mendeley-password = Password

general-error = Error
file-interface-import-error = An error occurred while trying to import the selected file. Please ensure that the file is valid and try again.
file-interface-import-complete = Import Complete
file-interface-items-were-imported = { $numItems ->
    [0] No items were imported
    [one] One item was imported
    *[other] { $numItems } items were imported
    }
file-interface-items-were-relinked = { $numRelinked ->
    [0] No items were relinked
    [one] One item was relinked
    *[other] { $numRelinked } items were relinked
    }

import-mendeley-encrypted = The selected Mendeley database cannot be read, likely because it is encrypted. See <a data-l10n-name="mendeley-import-kb">How do I import a Mendeley library into Zotero?</a> for more information.
                            
file-interface-import-error-translator = An error occurred importing the selected file with “{ $translator }”. Please ensure that the file is valid and try again.

import-online-intro=In the next step you will be asked to log in to { $targetAppOnline } and grant { -app-name } access. This is necessary to import your { $targetApp } library into { -app-name }.
import-online-intro2={ -app-name } will never see or store your { $targetApp } password.
import-online-form-intro = Please enter your credentials to log in to { $targetAppOnline }. This is necessary to import your { $targetApp } library into { -app-name }.
import-online-wrong-credentials = Login to { $targetApp } failed. Please re-enter credentials and try again.
import-online-blocked-by-plugin = The import cannot continue with { $plugin } installed. Please disable this plugin and try again.
import-online-relink-only =
    .label = Relink Mendeley Desktop citations
import-online-relink-kb = More Information

report-error =
    .label = Report Error…

rtfScan-wizard =
    .title = RTF Scan

rtfScan-introPage-description = { -app-name } can automatically extract and reformat citations and insert a bibliography into RTF files. To get started, choose an RTF file below.
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

rtfScan-scanPage-description = { -app-name } is scanning your document for citations. Please be patient.

rtfScan-citations-page =
    .label = Verify Cited Items

rtfScan-citations-page-description = Please review the list of recognized citations below to ensure that { -app-name } has selected the corresponding items correctly. Any unmapped or ambiguous citations must be resolved before proceeding to the next step.

rtfScan-style-page =
    .label = Document Formatting

rtfScan-format-page =
    .label = Formatting Citations

rtfScan-format-page-description = { -app-name } is processing and formatting your RTF file. Please be patient.

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


publications-intro-page =
    .label = My Publications

publications-intro = Items you add to My Publications will be shown on your profile page on zotero.org. If you choose to include attached files, they will be made publicly available under the license you specify. Only add work you yourself have created, and only include files if you have the rights to distribute them and wish to do so.
publications-include-checkbox-files =
    .label = Include files
publications-include-checkbox-notes =
    .label = Include notes

publications-include-adjust-at-any-time = You can adjust what to show at any time from the My Publications collection.
publications-intro-authorship =
    .label = I created this work.
publications-intro-authorship-files =
    .label = I created this work and have the rights to distribute included files.

publications-sharing-page =
    .label = Choose how your work may be shared

publications-sharing-keep-rights-field = 
    .label = Keep the existing Rights field
publications-sharing-keep-rights-field-where-available = 
    .label = Keep the existing Rights field where available
publications-sharing-text = You can reserve all rights to your work, license it under a Creative Commons license, or dedicate it to the public domain. In all cases, the work will be made publicly available via zotero.org.
publications-sharing-prompt = Would you like to allow your work to be shared by others?
publications-sharing-reserved =
    .label = No, only publish my work on zotero.org
publications-sharing-cc =
    .label = Yes, under a Creative Commons license
publications-sharing-cc0 =
    .label = Yes, and place my work in the public domain

publications-license-page =
    .label = Choose a Creative Commons license
publications-choose-license-text = A Creative Commons license allows others to copy and redistribute your work as long as they give appropriate credit, provide a link to the license, and indicate if changes were made. Additional conditions can be specified below.
publications-choose-license-adaptations-prompt = Allow adaptations of your work to be shared?

publications-choose-license-yes =
    .label = Yes
    .accesskey = Y
publications-choose-license-no =
    .label = No
    .accesskey = N
publications-choose-license-sharealike =
    .label = Yes, as long as others share alike
    .accesskey = S

publications-choose-license-commercial-prompt = Allow commercial uses of your work?
publications-buttons-add-to-my-publications =
    .label = Add to My Publications
publications-buttons-next-sharing =
    .label = Next: Sharing
publications-buttons-next-choose-license =
    .label = Choose a License

licenses-cc-0 = CC0 1.0 Universal Public Domain Dedication
licenses-cc-by = Creative Commons Attribution 4.0 International License
licenses-cc-by-nd = Creative Commons Attribution-NoDerivatives 4.0 International License
licenses-cc-by-sa = Creative Commons Attribution-ShareAlike 4.0 International License
licenses-cc-by-nc = Creative Commons Attribution-NonCommercial 4.0 International License
licenses-cc-by-nc-nd = Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International License
licenses-cc-by-nc-sa = Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License
licenses-cc-more-info = Be sure you have read the Creative Commons <a data-l10n-name="license-considerations">Considerations for licensors</a> before placing your work under a CC license. Note that the license you apply cannot be revoked, even if you later choose different terms or cease publishing the work.
licenses-cc0-more-info = Be sure you have read the Creative Commons <a data-l10n-name="license-considerations">CC0 FAQ</a> before applying CC0 to your work. Please note that dedicating your work to the public domain is irreversible, even if you later choose different terms or cease publishing the work.

restart-in-safe-mode-menuitem =
    .label = Restart in Safe Mode…
    .accesskey = S
restart-in-safe-mode-dialog-title = Restart in Safe Mode
restart-in-safe-mode-dialog-description = { -app-name } will restart with all plugins disabled. Some features may not function correctly while Safe Mode is enabled.
