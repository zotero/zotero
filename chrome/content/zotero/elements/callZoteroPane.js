// Function to view attachment in Zotero
function viewAttachment(attachmentId) {
    try {
        // Get the Zotero pane window
        const zp = window.ZoteroPane;
        if (!zp) {
            Zotero.debug('callZoteroPane: ZoteroPane not found');
            return;
        }
        
        // View the attachment
        zp.viewAttachment(attachmentId);
        Zotero.debug(`callZoteroPane: Viewed attachment ${attachmentId}`);
    } catch (error) {
        Zotero.debug(`callZoteroPane: Error viewing attachment: ${error.message}`);
    }
}

// Export the function
export { viewAttachment };
