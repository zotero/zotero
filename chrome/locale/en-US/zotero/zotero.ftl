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
                            

file-interface-import-error = = An error occurred while trying to import the selected file. Please ensure that the file is valid and try again.
file-interface-import-error-translator = An error occurred importing the selected file with “{ $translator }”. Please ensure that the file is valid and try again.

# Variables:
#   $targetAppOnline (String)
#   $targetApp (String)
import-online-intro=In the next step you will be asked to log in to { $targetAppOnline } and grant { -app-name } access. This is necessary to import your { $targetApp } library into { -app-name }.
import-online-intro2={ -app-name } will never see or store your { $targetApp } password.

report-error =
    .label = Report Error…