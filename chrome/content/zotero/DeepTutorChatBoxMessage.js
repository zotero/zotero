 
import React from 'react'; // eslint-disable-line no-unused-vars
import PropTypes from 'prop-types';
import DeepTutorStreamingComponent from './DeepTutorStreamingComponent';
import { StoppingTag } from './DeepTutorStreamingTag';

const markdownit = require('markdown-it');
// Try to require markdown-it-container, fallback to a simpler implementation if not available
try {
	require('markdown-it-container');
}
catch {
	// Fallback implementation for markdown-it-container
}
const md = markdownit({
	html: true,
	linkify: true,
	typographer: true,
	tables: true, // Enable built-in table support
	breaks: false, // GFM line breaks (optional)
	strikethrough: true, // Enable strikethrough support
});

// Re-enable markdown-it-katex plugin now that XML parsing is fixed
const mk = require('resource://zotero/markdown-it-katex.js');
md.use(mk, {
	throwOnError: false,
	errorColor: "#cc0000"
});

// Try to add enhanced table support with plugins
try {
	// Try to load markdown-it-table plugin for enhanced table features
	const markdownItTable = require('markdown-it-table');
	md.use(markdownItTable);
}
catch {
	// Try alternative GFM plugin that includes tables
	try {
		const markdownItGfm = require('markdown-it-gfm');
		md.use(markdownItGfm);
	}
	catch {
		// Using basic table support only
	}
}

const MessageRole = {
	TUTOR: 'TUTOR',
	USER: 'USER'
};

const DeepTutorChatBoxMessage = ({
	message,
	index,
	messages,
	sessionId,
	_documentIds,
	currentSession,
	noteContainer,
	isSavingNote,
	iniWait,
	streamingComponentVisibility,
	toggleStreamingComponent,
	handleQuestionClick,
	setHoveredQuestion,
	hoveredQuestion,
	colors,
	theme
}) => {
	// Format response text for markdown rendering
	const formatResponseForMarkdown = (text, subMessage) => {
		if (!text || typeof text !== 'string') {
			return '';
		}
		
		// Helper function to remove custom tags from text
		const removeSubstrings = (originalString, substringsToRemove) => {
			let currentString = originalString;
			for (let i = 0; i < substringsToRemove.length; i++) {
				const substring = substringsToRemove[i];
				if (typeof substring === 'string') {
					const index = currentString.indexOf(substring);
					if (index !== -1) {
						currentString = currentString.slice(0, index)
							+ currentString.slice(index + (substring?.length || 0));
					}
				}
			}
			return currentString;
		};

		// Extract only the response content, removing custom tags
		let cleanText = text;
		
		// Check if text contains custom tags and extract only the response part
		if (text.includes('<response>')) {
			const responseIndex = text.indexOf('<response>') + '<response>'.length;
			const endResponseIndex = text.indexOf('</response>');
			if (endResponseIndex !== -1) {
				cleanText = text.substring(responseIndex, endResponseIndex);
			}
			else {
				cleanText = text.substring(responseIndex);
			}
		}
		// Replacement for source span identifier
		cleanText = cleanText.replace(/\[<(\d{1,2})>\]/g, (match, sourceId) => {
			const sourceIndex = parseInt(sourceId) - 1; // Convert to 0-based index
			
			// Get the source data from subMessage.sources
			if (subMessage && subMessage.sources && subMessage.sources[sourceIndex]) {
				const source = subMessage.sources[sourceIndex];
				
				// Store source data in Zotero.Prefs
				const storageKey = `deeptutor_source_${sessionId}_${sourceIndex}`;
				const sourceData = {
					index: source.index || sourceIndex,
					refinedIndex: source.refinedIndex !== undefined ? source.refinedIndex : source.index || sourceIndex,
					page: source.page || 1,
					referenceString: source.referenceString || '',
					sourceAnnotation: source.sourceAnnotation || {}
				};
				Zotero.Prefs.set(storageKey, JSON.stringify(sourceData));
				
				// Create HTML span with minimal data
				const htmlSpan = `<span class="deeptutor-source-placeholder" data-source-id="${sourceId}" data-page="${source.page || 'Unknown'}">[${sourceId}]</span>`;
				return htmlSpan;
			}
			else {
				// Fallback if source not found
				const storageKey = `deeptutor_source_${sessionId}_${sourceIndex}`;
				const fallbackData = {
					index: sourceIndex,
					refinedIndex: sourceIndex,
					page: 1,
					referenceString: '',
					sourceAnnotation: {}
				};
				Zotero.Prefs.set(storageKey, JSON.stringify(fallbackData));
				
				const htmlSpan = `<span class="deeptutor-source-placeholder" data-source-id="${sourceId}" data-page="Unknown">[${sourceId}]</span>`;
				return htmlSpan;
			}
		});

		// Remove any remaining custom tags that might interfere with XML parsing
		cleanText = removeSubstrings(cleanText, [
			'<thinking>',
			'</thinking>',
			'<think>',
			'</think>',
			'<followup_question>',
			'</followup_question>',
			'<source_page>',
			'</source_page>',
			'<sources>',
			'</sources>',
			'<id>',
			'</id>',
			'<appendix>',
			'</appendix>'
		]);
			
		// Now apply mathematical symbol processing and source processing to the clean text
		let formattedText = cleanText;

		// Replace inline math-like expressions (e.g., \( u \)) with proper Markdown math
		formattedText = formattedText.replace(/\\\((.+?)\\\)/g, '$$$1$$');

		// Replace block math-like expressions (e.g., \[ ... \]) with proper Markdown math
		formattedText = formattedText.replace(
			/\\\[([\s\S]+?)\\\]/g,
			'$$$$\n$1\n$$$$',
		);
		return formattedText;
	};

	// Process markdown result to fix JSX compatibility issues using enhanced regex and Zotero-compatible parsing
	const processMarkdownResult = (html) => {
		if (!html || typeof html !== "string") {
			return "";
		}
		
		try {
			// Try to use available DOM parsing APIs
			let parser = null;
			let serializer = null;
			
			// Try xmldom package first (if available)
			try {
				const xmldom = require('resource://zotero/xmldom.js');
				if (xmldom && xmldom.DOMParser && xmldom.XMLSerializer) {
					parser = new xmldom.DOMParser();
					serializer = new xmldom.XMLSerializer();
				}
			}
			catch (e) {
				Zotero.debug(e);
			}
			
			// Fallback to native DOM APIs if xmldom not available
			if (!parser) {
				// Check for DOMParser availability in different contexts
				if (typeof DOMParser !== 'undefined') {
					parser = new DOMParser();
					serializer = new XMLSerializer();
				}
				else if (typeof window !== 'undefined' && window.DOMParser) {
					parser = new window.DOMParser();
					serializer = new window.XMLSerializer();
				}
				else if (typeof Components !== 'undefined') {
					// Try Firefox/XUL specific APIs
					try {
						parser = Components.classes["@mozilla.org/xmlextras/domparser;1"]
							.createInstance(Components.interfaces.nsIDOMParser);
						serializer = Components.classes["@mozilla.org/xmlextras/xmlserializer;1"]
							.createInstance(Components.interfaces.nsIDOMSerializer);
					}
					catch (e) {
						Zotero.debug(e);
					}
				}
			}
			
			if (parser && serializer) {
				// DOM parsing is available, use it
				// Pre-process HTML to fix common XML compatibility issues
				let preprocessedHtml = html
					// Fix self-closing tags to be XML compliant
					.replace(/<(br|hr|img|input|area|base|col|embed|link|meta|param|source|track|wbr)(\s[^>]*)?>/gi, '<$1$2/>')
					// Fix attributes without quotes
					.replace(/(\w+)=([^"\s>]+)(?=[\s>])/g, '$1="$2"')
					// Convert HTML entities to XML-safe equivalents
					.replace(/&nbsp;/g, '&#160;');
				
				const wrappedHtml = `<root>${preprocessedHtml}</root>`;
				// Try parsing as HTML first, then convert to XML
				let doc = null;
					
				// First attempt: Parse as HTML (if the parser supports it)
				if (parser.parseFromString) {
					try {
						doc = parser.parseFromString(wrappedHtml, 'text/html');
					}
					catch (htmlError) {
						Zotero.debug(htmlError);
					}
				}
					
				// Second attempt: Parse as XML if HTML parsing failed or not supported
				if (!doc || !doc.documentElement || doc.documentElement.tagName === 'parsererror') {
					try {
						doc = parser.parseFromString(wrappedHtml, 'application/xml');
							
						// Check if parsing was successful (no parsererror elements)
						const parseError = doc.querySelector ? doc.querySelector('parsererror') : null;
						if (parseError) {
							throw new Error('XML parsing failed');
						}
					}
					catch (xmlError) {
						Zotero.debug(xmlError);
						throw new Error('Both HTML and XML parsing failed');
					}
				}
					
				// Function to recursively fix self-closing tags
				const fixXmlCompatibility = (node) => {
					if (node.nodeType === 1) { // ELEMENT_NODE
						const tagName = node.tagName.toLowerCase();
							
						// List of self-closing HTML tags
						const selfClosingTags = [
							'area',
							'base',
							'br',
							'col',
							'embed',
							'hr',
							'img',
							'input',
							'link',
							'meta',
							'param',
							'source',
							'track',
							'wbr'
						];
							
						// For self-closing tags, ensure they have no children
						if (selfClosingTags.includes(tagName)) {
							while (node.firstChild) {
								node.removeChild(node.firstChild);
							}
						}
							
						// Process child elements
						const children = Array.from(node.children || []);
						for (const child of children) {
							fixXmlCompatibility(child);
						}
					}
				};
					
				// Fix XML compatibility
				fixXmlCompatibility(doc.documentElement);
					
				// Serialize back to string
				const serializedXml = serializer.serializeToString(doc.documentElement);
				let result = serializedXml.replace(/^<root[^>]*>/, '').replace(/<\/root>$/, '');
					
				// Clean up whitespace: remove spaces around specific HTML tags
				result = result
						// Remove spaces before opening tags
						.replace(/\s+<(ol|ul|li|p|div|span|h[1-6])>/g, '<$1>')
						// Remove spaces after opening tags
						.replace(/<(ol|ul|li|p|div|span|h[1-6])>\s+/g, '<$1>')
						// Remove spaces before closing tags
						.replace(/\s+<\/(ol|ul|li|p|div|span|h[1-6])>/g, '</$1>')
						// Remove spaces after closing tags
						.replace(/<\/(ol|ul|li|p|div|span|h[1-6])>\s+/g, '</$1>')
						// Remove spaces at the beginning and end of the entire string
						.trim();
					
				return result;
			}
			
			else {
				// No DOM parsing available, skip to regex
				throw new Error('No DOM parsing APIs available');
			}
		}
		catch (error) {
			Zotero.debug(error);
			// Enhanced regex-based approach with better XML compatibility
			let processedHtml = html;
			
			// Fix self-closing tags step by step with validation
			const selfClosingTagPatterns = [
				{ tag: 'br', pattern: /<br(\s[^>]*)?>/gi },
				{ tag: 'hr', pattern: /<hr(\s[^>]*)?>/gi },
				{ tag: 'img', pattern: /<img(\s[^>]*)?>/gi },
				{ tag: 'input', pattern: /<input(\s[^>]*)?>/gi },
				{ tag: 'area', pattern: /<area(\s[^>]*)?>/gi },
				{ tag: 'base', pattern: /<base(\s[^>]*)?>/gi },
				{ tag: 'col', pattern: /<col(\s[^>]*)?>/gi },
				{ tag: 'embed', pattern: /<embed(\s[^>]*)?>/gi },
				{ tag: 'link', pattern: /<link(\s[^>]*)?>/gi },
				{ tag: 'meta', pattern: /<meta(\s[^>]*)?>/gi },
				{ tag: 'param', pattern: /<param(\s[^>]*)?>/gi },
				{ tag: 'source', pattern: /<source(\s[^>]*)?>/gi },
				{ tag: 'track', pattern: /<track(\s[^>]*)?>/gi },
				{ tag: 'wbr', pattern: /<wbr(\s[^>]*)?>/gi }
			];
			
			// Process each self-closing tag type
			for (const { tag, pattern } of selfClosingTagPatterns) {
				processedHtml = processedHtml.replace(pattern, (match, attributes) => {
					const attrs = attributes || '';
					// Ensure the tag is self-closed and doesn't already end with />
					if (match.endsWith('/>')) {
						return match; // Already self-closed
					}
					else {
						return `<${tag}${attrs}/>`;
					}
				});
			}
			
			// Fix common attribute quoting issues
			processedHtml = processedHtml.replace(/(\w+)=([^"\s>]+)(?=[\s>])/g, '$1="$2"');
			
			// Fix HTML entities that might cause XML parsing issues
			processedHtml = processedHtml
				.replace(/&nbsp;/g, '&#160;')
				.replace(/&amp;/g, '&amp;') // Ensure & is properly escaped
				.replace(/&lt;/g, '&lt;')
				.replace(/&gt;/g, '&gt;')
				.replace(/&quot;/g, '&quot;')
				.replace(/&apos;/g, '&apos;');
			
			// Fix any remaining unclosed tags that could cause issues
			// This is a basic fix for common markdown-it output issues
			const unclosedTagPattern = /<(p|div|span|strong|em|ul|ol|li|h[1-6]|blockquote|code|pre)(\s[^>]*)?(?!.*<\/\1>)/gi;
			const tagMatches = [];
			let match;
			
			// Find unclosed tags (basic detection)
			while ((match = unclosedTagPattern.exec(processedHtml)) !== null) {
				tagMatches.push({
					tag: match[1],
					fullMatch: match[0],
					index: match.index
				});
			}
			
			// Clean up whitespace: remove spaces around specific HTML tags
			processedHtml = processedHtml
				// Remove spaces before opening tags
				.replace(/\s+<(ol|ul|li|p|div|span|h[1-6])>/g, '<$1>')
				// Remove spaces after opening tags
				.replace(/<(ol|ul|li|p|div|span|h[1-6])>\s+/g, '<$1>')
				// Remove spaces before closing tags
				.replace(/\s+<\/(ol|ul|li|p|div|span|h[1-6])>/g, '</$1>')
				// Remove spaces after closing tags
				.replace(/<\/(ol|ul|li|p|div|span|h[1-6])>\s+/g, '</$1>')
				// Remove spaces at the beginning and end of the entire string
				.trim();
			
			return processedHtml;
		}
	};



	// Function to download/save a message as a Zotero note
	const downloadMessage = async (message, messageIndex) => {
		if (!message) {
			return;
		}

		if (!noteContainer) {
			// Show user-friendly message
			// Zotero.alert(null, "Cannot Create Note", "Cannot create note: No parent item available. Please ensure documents are loaded.");
			return;
		}

		// Set saving state to true
		// Note: This would need to be passed as a prop or handled differently
		// setIsSavingNote(true);

		try {
			// Extract and clean the message text
			let noteText = '';
			if (message.subMessages && message.subMessages.length > 0) {
				// Combine all subMessage texts
				noteText = message.subMessages
					.filter(subMsg => subMsg.text && subMsg.text.trim())
					.map(subMsg => subMsg.text.trim())
					.join('\n\n');
			}

			// Clean the text - remove source references, follow-up questions, and other UI elements
			if (noteText) {
				// Remove source span identifiers like [<1>], [<2>], etc.
				noteText = noteText.replace(/\[<(\d{1,2})>\]/g, '');
				
				// Remove custom tags that might interfere
				noteText = noteText.replace(/<\/?(?:thinking|think|followup_question|source_page|sources|id|appendix)>/g, '');
				
				// Convert markdown-style formatting to basic HTML for better readability
				noteText = noteText
					// Convert **bold** to <strong>bold</strong>
					.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
					// Convert *italic* to <em>italic</em>
					.replace(/\*(.*?)\*/g, '<em>$1</em>')
					// Convert line breaks to HTML breaks
					.replace(/\n/g, '<br>')
					// Clean up multiple spaces
					.replace(/\s\s+/g, ' ')
					.trim();
			}

			if (!noteText) {
				// Zotero.alert(null, "Cannot Create Note", "Cannot create note: Message appears to be empty.");
				// setIsSavingNote(false);
				return;
			}

			// Create the note
			let noteName = '';
			let containerName = '';
			
			await Zotero.DB.executeTransaction(async () => {
				const noteItem = new Zotero.Item('note');
				noteItem.libraryID = Zotero.Items.get(noteContainer).libraryID;
				
				// Set the parent item
				noteItem.parentID = noteContainer;
				
				// Create note title from the first line or a default
				const titleText = noteText.replace(/<[^>]*>/g, '').substring(0, 100);
				const _noteTitle = titleText.length > 100 ? titleText.substring(0, 97) + '...' : titleText;
				
				// Prepare the final note content with proper HTML structure
				const fullNoteContent = `<div class="zotero-note znv1">
					<h3>DeepTutor Message ${messageIndex + 1}</h3>
					<p><strong>Session:</strong> ${currentSession?.sessionName || 'Unknown Session'}</p>
					<p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
					<hr>
					<div>${noteText}</div>
				</div>`;
				
				// Set the note content
				noteItem.setNote(fullNoteContent);
				
				// Save the note
				const noteID = await noteItem.save({
					notifierData: {
						autoSyncDelay: Zotero.Notes.AUTO_SYNC_DELAY
					}
				});
				
				// Get the note name and container name for the success message
				const savedNote = Zotero.Items.get(noteID);
				noteName = savedNote.getNoteTitle();
				
				const parentItem = Zotero.Items.get(noteContainer);
				containerName = parentItem.getDisplayTitle();
			});
			
			// Show success message with actual names
			Zotero.alert(null, "Note Created Successfully", `Note "${noteName}" created successfully in "${containerName}".`);
		}
		catch (error) {
			 Zotero.alert(null, "Error Creating Note", `Error creating note: ${error.message}`);
		}
		finally {
			// Always reset the saving state, regardless of success or failure
			// setIsSavingNote(false);
		}
	};

	// Return nothing if it's the first message and from user
	if (index === 0 && message.role === MessageRole.USER) {
		return null;
	}
    
	const isUser = message.role === MessageRole.USER;
	const messageId = message.id || index;
	const isStreamingComponentVisible = streamingComponentVisibility[messageId] === true; // Default to false
	
	// Message-related styles
	const styles = {
		messageContainer: {
			width: '100%',
			margin: '0rem 0',
			boxSizing: 'border-box',
			display: 'flex',
			flexDirection: 'column',
		},
		messageBubble: {
			padding: '0rem 0.75rem',
			borderRadius: '0.625rem',
			maxWidth: '100%',
			boxShadow: 'none',
			animation: 'slideIn 0.3s ease-out forwards',
			height: 'auto',
			whiteSpace: 'pre-wrap',
			wordBreak: 'break-word',
			boxSizing: 'border-box',
			overflowWrap: 'break-word',
			userSelect: 'text',
			WebkitUserSelect: 'text',
			MozUserSelect: 'text',
			msUserSelect: 'text',
		},
		userMessage: {
			backgroundColor: colors.message.user,
			color: colors.message.userText,
			marginLeft: 'auto',
			marginRight: '1rem',
			borderRadius: '0.625rem',
			fontWeight: 400,
			textAlign: 'left',
			alignSelf: 'flex-end',
			maxWidth: '85%',
			width: 'fit-content',
			fontSize: '0.875rem',
			lineHeight: '1.2',
			letterSpacing: '0.02em',
			padding: '0rem 1.25rem',
		},
		botMessage: {
			backgroundColor: colors.message.bot,
			color: colors.message.botText,
			marginRight: 'auto',
			marginLeft: 0,
			borderBottomLeftRadius: '0.25rem',
			borderRadius: '1rem',
			fontWeight: 400,
			alignSelf: 'flex-start',
		},
		messageText: {
			display: 'block',
			maxWidth: '100%',
			overflowWrap: 'break-word',
			wordBreak: 'break-word',
			userSelect: 'text',
			WebkitUserSelect: 'text',
			MozUserSelect: 'text',
			msUserSelect: 'text',
			cursor: 'text',
		},
		questionContainer: {
			all: 'revert',
			width: '100%',
			margin: '0rem 0 1.5rem 0',
			display: 'flex',
			flexDirection: 'column',
			justifyContent: 'flex-start',
			gap: '0.75rem',
			flexWrap: 'wrap',
			boxSizing: 'border-box',
		},
		questionButton: {
			all: 'revert',
			background: colors.button.secondary,
			color: theme === 'dark' ? '#ffffff' : colors.button.secondaryText,
			border: `1px solid ${colors.button.secondaryBorder}`,
			borderRadius: '0.625rem',
			padding: '0.625rem 1.25rem',
			minWidth: '8rem',
			maxWidth: '85%',
			fontWeight: 500,
			fontSize: '1rem',
			lineHeight: '1.5',
			letterSpacing: '0.02em',
			cursor: 'pointer',
			boxShadow: '0 0.0625rem 0.125rem rgba(0,0,0,0.04)',
			textAlign: 'left',
			fontFamily: 'Roboto, sans-serif',
			height: 'auto',
			whiteSpace: 'pre-wrap',
			wordBreak: 'break-word',
			transition: 'background 0.2s',
			boxSizing: 'border-box',
			overflowWrap: 'break-word',
			alignSelf: 'flex-end',
			marginLeft: 'auto',
			marginRight: '1rem',
		},
		followUpQuestionText: {
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'flex-end',
			fontSize: '0.875rem',
			fontWeight: 400,
			color: theme === 'dark' ? '#ffffff' : '#757575',
			lineHeight: '1.35',
			cursor: 'pointer',
			marginRight: '1rem',
		}
	};
	
	return (
		<div>
			{/* Show streaming component toggle button for non-streaming messages with streamText */}
			{!message.isStreaming && message.streamText && (
				<div style={{
					display: 'flex',
					justifyContent: 'flex-start',
					marginTop: '1.5rem',
				}}>
					<button
						style={{
							all: 'revert',
							display: 'flex',
							width: 'fit-content',
							borderRadius: '0.375rem',
							border: `2px solid ${theme === 'dark' ? colors.sky : '#E0E0E0'}`,
							paddingLeft: '1rem',
							paddingRight: '1rem',
							paddingTop: '0.5rem',
							paddingBottom: '0.5rem',
							marginTop: '0.5rem',
							marginBottom: '0.5rem',
							fontFamily: 'Roboto, sans-serif',
							fontSize: '0.875rem',
							alignItems: 'center',
							color: colors.text.allText,
							background: colors.background.quaternary,
							cursor: 'pointer',
							transition: 'background-color 0.2s',
							fontWeight: 500
						}}
						onClick={() => toggleStreamingComponent(messageId)}
						onMouseEnter={e => e.target.style.background = colors.background.primary}
						onMouseLeave={e => e.target.style.background = colors.background.quaternary}
						title={isStreamingComponentVisible ? "Hide streaming view" : "Show streaming view"}
					>
						{isStreamingComponentVisible ? "Hide Thinking Process" : message.streamText.includes('<stopped>') ? "Show Stopped Thinking Process" : "Show Thinking Process"}
					</button>
				</div>
			)}
			
			{/* Show streaming component during streaming OR when explicitly visible */}
			{(message.isStreaming || isStreamingComponentVisible) && (
				<div key={`streaming-${messageId}`} style={styles.messageContainer}>
					<DeepTutorStreamingComponent
						streamText={message.streamText || ''}
						hideStreamResponse={!message.isStreaming}
					/>
				</div>
			)}
			
			{/* Show regular message content for non-streaming messages */}
			{!message.isStreaming && (
				<div key={`content-${messageId}`} style={styles.messageContainer}>
					<div style={{
						...styles.messageBubble,
						...(isUser ? styles.userMessage : styles.botMessage),
						animation: "slideIn 0.3s ease-out",
						...(isUser && { display: 'flex', alignItems: 'flex-start' })
					}}>
						{/* Add user message icon inside the bubble for user messages */}
						{message.subMessages.map((subMessage, subIndex) => {
							const text = formatResponseForMarkdown(subMessage.text || "", subMessage);
							try {
								var result = md.render(text);
							
								// Process through DOM-based XML conversion
								const processedResult = processMarkdownResult(result);
							
								return (
									<div key={subIndex} style={styles.messageText}>
										{/* Render text content through markdown-it with DOM-processed XML */}
										{processedResult
											? (
												<div
													className="markdown mb-0 flex flex-col"
													dangerouslySetInnerHTML={{
														__html: (() => {
															return processedResult;
														})()
													}}
													style={{
														fontSize: "14px",
														lineHeight: "1.5",
														wordBreak: "break-word",
														overflowWrap: "break-word"
													}}
												/>
											)
											: (
												<div style={{
													fontSize: "14px",
													lineHeight: "1.5",
													wordBreak: "break-word",
													overflowWrap: "break-word"
												}}>
													{subMessage.text || ""}
												</div>
											)}
									</div>
								);
							}
							catch {
							// Fallback to plain text if markdown processing fails
								return (
									<div key={subIndex} style={styles.messageText}>
										<div style={{
											fontSize: "16px",
											lineHeight: "1.5",
											wordBreak: "break-word",
											overflowWrap: "break-word"
										}}>
											{subMessage.text || ""}
										</div>
									</div>
								);
							}
						})}
					</div>
				
					{/* Show StoppingTag if message contains <stopped> tag */}
					{!isUser && (message.subMessages.some(subMsg => subMsg.text && subMsg.text.includes('<stopped>'))
						|| (message.streamText && message.streamText.includes('<stopped>'))) && (
						<StoppingTag />
					)}
				
					{/* Add download button for tutor messages only */}
					{!isUser && noteContainer && !message.isStreaming && !iniWait && !isSavingNote && (
						<div style={{
							display: 'flex',
							justifyContent: 'flex-start',
							marginTop: '0rem',
							marginBottom: '3rem',
							marginLeft: '0'
						}}>
							<button
								style={{
									all: 'revert',
									background: '#FFFFFF',
									color: '#0687E5',
									border: '1px solid #0687E5',
									borderRadius: '0.625rem',
									padding: '0.25rem 0.5rem',
									fontSize: '0.875rem',
									fontWeight: 500,
									cursor: 'pointer',
									boxShadow: '0 0.0625rem 0.125rem rgba(0,0,0,0.1)',
									transition: 'background-color 0.2s',
									fontFamily: 'Roboto, sans-serif',
									display: 'flex',
									alignItems: 'center',
									gap: '0.25rem'
								}}
								onClick={() => downloadMessage(message, index)}
								onMouseEnter={e => e.target.style.background = '#f0f8ff'}
								onMouseLeave={e => e.target.style.background = '#FFFFFF'}
								title={`Save message ${index + 1} as Zotero note`}
							>
								📝 Save as Note
							</button>
						</div>
					)}
				
					{index === messages.length - 1 && message.followUpQuestions && message.followUpQuestions.length > 0 && (
						<div>
							<div style={styles.followUpQuestionText}>
							Follow-up Questions
							</div>
							<div style={{
								...styles.questionContainer,
								marginTop: '0.3125rem'
							}}>
								{message.followUpQuestions.map((question, qIndex) => (
									<button
										key={qIndex}
										style={{
											...styles.questionButton,
											background: hoveredQuestion === qIndex ? colors.button.hover : colors.button.secondary
										}}
										onClick={() => handleQuestionClick(question)}
										onMouseEnter={() => setHoveredQuestion(qIndex)}
										onMouseLeave={() => setHoveredQuestion(null)}
									>
										{question}
									</button>
								))}
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	);
};

DeepTutorChatBoxMessage.propTypes = {
	message: PropTypes.object.isRequired,
	index: PropTypes.number.isRequired,
	messages: PropTypes.array.isRequired,
	sessionId: PropTypes.string,
	_documentIds: PropTypes.array,
	currentSession: PropTypes.object,
	noteContainer: PropTypes.any,
	isSavingNote: PropTypes.bool,
	iniWait: PropTypes.bool,
	streamingComponentVisibility: PropTypes.object,
	toggleStreamingComponent: PropTypes.func,
	handleQuestionClick: PropTypes.func,
	setHoveredQuestion: PropTypes.func,
	hoveredQuestion: PropTypes.number,
	colors: PropTypes.object.isRequired,
	theme: PropTypes.string.isRequired
};

export default DeepTutorChatBoxMessage;
