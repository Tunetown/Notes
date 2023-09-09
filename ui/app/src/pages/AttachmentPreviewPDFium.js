/**
 * Shows a simple preview of an attachment, if possible. Using PDFJS lib.
 * 
 * (C) Thomas Weber 2021 tom-vibrant@gmx.de
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
class AttachmentPreviewPDFium {
	
	/**
	 * Singleton factory
	 */
	static getInstance() {
		if (!AttachmentPreviewPDFium.instance) AttachmentPreviewPDFium.instance = new AttachmentPreviewPDFium();
		return AttachmentPreviewPDFium.instance;
	}
	
	/**
	 * PDFs do not support focussing, so we deactivate that completely for attachments.
	 *
	overrideFocusId() {
		return Notes.FOCUS_ID_EDITOR;
	}
	
	/**
	 * Reset the "currently shown" flags
	 */
	unload() {
		this.current = false;
		this.currentUrl = false;
		
		PDFiumWrapper.getInstance().destroyAll();
	}
	
	/**
	 * Must return true if linkage from navigation to this page is supported.
	 * If so, this class must implement an updateFromLinkage(id) instance method!
	 */
	supportsLinkageFromNavigation() {
		return true;
	}
	
	/**
	 * Update the content from navigation if enabled.
	 */
	updateFromLinkage(id) {
		// In this case, just redirect to the document.
		Notes.getInstance().routing.call(id);
	}
	
	/**
	 * Loads the passed version history data into the versions view.
	 */
	load(doc, url, blob) {
		var that = this;
		var n = Notes.getInstance();
		n.setCurrentPage(this);

		n.setButtons([ 
			$('<div type="button" data-toggle="tooltip" title="Download ' + doc.name + '" id="dnldButton" class="fa fa-download" onclick="event.stopPropagation();AttachmentPreviewPDFium.getInstance().download();"></div>'),
			$('<div type="button" data-toggle="tooltip" title="Options..." id="editorOptionsButton" class="fa fa-ellipsis-v" onclick="event.stopPropagation();AttachmentPreviewPDFium.getInstance().callOptions(event);"></div>'),
		]);		
		
		var atts = Document.getAttachments(doc);
		if (!atts) {
			n.showAlert('Document ' + doc.name + ' has no attachments');
			return;
		}
		var att = atts['attachment_data'];
		if (!att) att = atts[doc.attachment_filename];
		 
		var attsize = Tools.convertFilesize(att.length);
		
		$('#contentContainer').empty();
		
		this.contentSize = {
			width: Math.floor($('#contentContainer').width()),
			height: Math.floor($('#contentContainer').height())
		};
		
		// Set note name in the header
		n.setStatusText(doc.name + ' (' + attsize + ')');

		if (doc.content_type && doc.content_type.startsWith('text/')) {
			// Interpret as text: Load content and show in text area
			$.ajax({
				url: url, 
				type: "get",
				dataType: "text",
				success: function( response ) {
					// Show in pre tag
					$('#contentContainer').append(
						$('<textarea readonly class="preview textpreview">' + response + '</textarea>')
					);
				},
			})
			.fail(function(response/*, status, error*/) {
				Notes.getInstance().showAlert('Server error ' + response.status + ': Please see the logs.');
			});
		} else 
		if (doc.content_type && (doc.content_type == 'application/pdf')) {
			var pdfium = PDFiumWrapper.getInstance();
			
			var startTime;
			
			pdfium.initWorker()
			.then(function() {
				startTime = Date.now();
				return pdfium.getDocument(doc._id, blob);
			})
			.then(function(pdf) {
				console.log('PDFium: Loaded document in ' + (Date.now() - startTime) + 'ms, ' + Tools.convertFilesize(blob.size));
				
				async function renderPage(index) {
					if (index >= pdf.numPages) return Promise.resolve();
					
					const stime = Date.now();
					
					var canvas = $('<canvas class="attachmentPdfiumCanvas"/>');
				
					$('#contentContainer').append(
						canvas
					);

					var page = pdf.getPage(index);
					
					const dimensions = page.getDimensions();
					const ratio = dimensions.height / dimensions.width;

					const w = (that.contentSize.width - 20);

					return page.render(canvas[0], w, w * ratio)
					.then(function() {
						console.log('PDFium: Rendered page ' + index + ' in ' + (Date.now() - stime) + 'ms');
						
						return renderPage(index + 1);
					});
				}
				
				startTime = Date.now();
				renderPage(0)
				.then(function() {
					console.log('PDFium: Rendered all pages in ' + (Date.now() - startTime) + 'ms');
				});
			});

		} else {
			// Try object tag to embed the content (for pdf/mp3/...)
			$('#contentContainer').append(
				$('<object class="preview" data="' + url + '" type="' + doc.content_type + '" ><span id="previewteaser">Preview not available</span></object>')
			);
		}
		
		this.current = doc;
		this.currentUrl = url;
		
		return Promise.resolve();
	}
	
	/**
	 * Download the shown attachment.
	 */
	download() {
		if (!this.current) return;
		
		var n = Notes.getInstance();
		
		var that = this;
		AttachmentActions.getInstance().getAttachmentUrl(this.current._id)
		.then(function(data) {
			if (!data.ok || !data.url) {
				n.showAlert(data.message ? data.message : 'Error downloading attachment', 'E', data.messageThreadId);
			}
			
			window.saveAs(data.url, that.current.name);
		})
		.catch(function(err) {
			n.showAlert('Error downloading attachment: ' + err.message, 'E', err.messageThreadId);
		});
	}
	
	/**
	 * Hides all option menus for the editor
	 */
	hideOptions() {
		Notes.getInstance().hideMenu();
	}
	
	/**
	 * Returns the ID of the loaded note, if any, or false if none is loaded.
	 */
	getCurrentId() {
		return this.current ? this.current._id : false;
	}
	
	/**
	 * Calls the options of the attachment
	 */
	callOptions(event) {
		event.stopPropagation();
		
		var n = Notes.getInstance();
		var that = AttachmentPreviewPDFium.getInstance();
		
		n.showMenu('attachmentOptions', function(cont) {
			cont.append(
				$('<div class="userbutton"><div class="fa fa-exchange-alt userbuttonIcon"></div>Update from File</div>')
				.on('click', function(event) {
					event.stopPropagation();
					that.hideOptions();	
					
					AttachmentActions.getInstance().updateAttachmentFromFile(that.getCurrentId())
					.then(function(data) {
						if (data.message) {
							n.showAlert(data.message, "S", data.messageThreadId);
						}
						
						n.routing.call(that.getCurrentId());
						
					}).catch(function(err) {
						n.showAlert(err.message, err.abort ? 'I' : "E", err.messageThreadId);
					});
				})
			);
			
			cont.append(
				PageMenu.get(that, {
					noHistory: true,
					noCopy: true,
					noDownload: true
				})
			);

			cont.append(
				$('<div class="userbutton"><div class="fa fa-eye userbuttonIcon"></div>Use native viewer</div>')
				.on('click', function(event) {
					event.stopPropagation();
					that.hideOptions();	
					
					var vs = ClientState.getInstance().getViewSettings();
					
					vs.useNativePdfViewer = true;
					
					ClientState.getInstance().saveViewSettings(vs);
					
					Notes.getInstance().routing.call(that.current._id);
				})
			);
		});
	}
}