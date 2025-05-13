function initializeReader(options) {
    // ... existing initialization code ...
    
    // Add context pane toggle handler
    options.onToggleContextPane = function() {
        var contextPane = document.getElementById('context-pane');
        var itemsSplitter = document.getElementById('zotero-items-splitter');
        if (!contextPane || !itemsSplitter) {
            Zotero.debug('Context pane or items splitter not found');
            return;
        }
        
        const isCollapsed = contextPane.getAttribute('collapsed') === 'true';
        contextPane.setAttribute('collapsed', !isCollapsed);
        
        // Update splitter state
        if (isCollapsed) {
            itemsSplitter.setAttribute('state', 'open');
        } else {
            itemsSplitter.setAttribute('state', 'collapsed');
        }
        
        // Update UI state
        document.body.classList.toggle('context-pane-open', !isCollapsed);
        
        // Trigger layout update
        if (typeof ZoteroPane !== 'undefined') {
            ZoteroPane.updateLayoutConstraints();
        }
    };
    
    // Add deep tutor pane toggle handler
    Zotero.debug('Initializing Deep Tutor pane toggle handler');
    options.onToggleDeepTutorPane = function() {
        Zotero.debug('Deep Tutor pane toggle clicked');
        
        var deepTutorPane = document.getElementById('deep-tutor-pane');
        var deeptutorSplitter = document.getElementById('zotero-deeptutor-splitter');
        
        if (!deepTutorPane) {
            Zotero.debug('Deep Tutor pane element not found');
            return;
        }
        
        if (!deeptutorSplitter) {
            Zotero.debug('Deep Tutor splitter element not found');
            return;
        }
        
        const isCollapsed = deepTutorPane.getAttribute('collapsed') === 'true';
        Zotero.debug('Deep Tutor pane current state: ' + (isCollapsed ? 'collapsed' : 'open'));
        
        // Update pane state
        deepTutorPane.setAttribute('collapsed', !isCollapsed);
        
        // Update splitter state
        if (isCollapsed) {
            deeptutorSplitter.setAttribute('state', 'open');
            Zotero.debug('Setting Deep Tutor splitter state to open');
        } else {
            deeptutorSplitter.setAttribute('state', 'collapsed');
            Zotero.debug('Setting Deep Tutor splitter state to collapsed');
        }
        
        // Update UI state
        document.body.classList.toggle('deep-tutor-pane-open', !isCollapsed);
        Zotero.debug('Updated body class: deep-tutor-pane-open = ' + !isCollapsed);
        
        // Trigger layout update
        if (typeof ZoteroPane !== 'undefined') {
            ZoteroPane.updateLayoutConstraints();
            Zotero.debug('Triggered layout constraints update');
        } else {
            Zotero.debug('ZoteroPane not available for layout update');
        }
        
        // Trigger any necessary events
        if (typeof Zotero.DeepTutor !== 'undefined') {
            Zotero.DeepTutor.onPaneToggle(!isCollapsed);
            Zotero.debug('Triggered DeepTutor.onPaneToggle event');
        } else {
            Zotero.debug('Zotero.DeepTutor not available for event handling');
        }
    };
    Zotero.debug('Deep Tutor pane toggle handler initialized');
    
    // Check debug logging
    Zotero.debug('Debug logging test - if you see this, debug logging is enabled');
    if (Zotero.Debug.enabled) {
        Zotero.debug('Debug logging is enabled');
    } else {
        Zotero.debug('Debug logging is disabled');
    }
    
    // ... rest of initialization code ...
} 