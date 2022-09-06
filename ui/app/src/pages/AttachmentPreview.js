/**
 * Shows a simple preview of an attachment, if possible.
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
class AttachmentPreview {
	
	/**
	 * Singleton factory
	 */
	static getInstance() {
		if (!AttachmentPreview.instance) AttachmentPreview.instance = new AttachmentPreview();
		return AttachmentPreview.instance;
	}
	
	/**
	 * Reset the "currently shown" flags
	 */
	unload() {
		this.current = false;
		this.currentUrl = false;
	}
	
	/**
	 * Loads the passed version history data into the versions view.
	 */
	load(doc, url) {
		var n = Notes.getInstance();

		var att = Document.getAttachments(doc)[doc.attachment_filename];
		var attsize = Tools.convertFilesize(att.length);
		
		// Set note name in the header
		n.setStatusText(doc.name + ' (' + attsize + ')');
		n.allowViewportScaling(true);

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
			.fail(function(response, status, error) {
				Notes.getInstance().showAlert('Server error ' + response.status + ': Please see the logs.');
			});
		} else {
			// Try object tag to embed the content (for pdf/mp3/...)
			$('#contentContainer').append(
				$('<object class="preview" data="' + url + '" type="' + doc.content_type + '" ><span id="previewteaser">Preview not available</span></object>')
			);
		}
		
		this.current = doc;
		this.currentUrl = url;
		
		n.setButtons([ 
			$('<div type="button" data-toggle="tooltip" title="Download ' + doc.name + '" id="dnldButton" class="fa fa-save" onclick="event.stopPropagation();AttachmentPreview.getInstance().download();"></div>'),
			$('<div type="button" data-toggle="tooltip" title="Options..." id="editorOptionsButton" class="fa fa-ellipsis-v" onclick="event.stopPropagation();AttachmentPreview.getInstance().callOptions(event);"></div>'),
		]);			
	}
	
	/**
	 * Download the shown attachment.
	 */
	download() {
		if (!this.current) return;
		
		var n = Notes.getInstance();
		
		var that = this;
		Actions.getInstance().getAttachmentUrl(this.current._id)
		.then(function(data) {
			if (!data.ok || !data.url) {
				n.showAlert(data.message ? data.message : 'Error downloading attachment', 'E');
			}
			
			window.saveAs(data.url, that.current.name);
		})
		.catch(function(err) {
			n.showAlert('Error downloading attachment: ' + err.message, 'E');
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
		var that = this;
		
		n.showMenu('attachmentOptions', function(cont) {
			cont.append(
				$('<div class="userbutton"><div class="fa fa-exchange-alt userbuttonIcon"></div>Update from File</div>')
				.on('click', function(event) {
					event.stopPropagation();
					that.hideOptions();	
					
					Actions.getInstance().updateAttachmentFromFile(that.getCurrentId())
					.then(function(data) {
						if (data.message) {
							n.showAlert(data.message, "S");
						}
						
						n.routing.call(that.getCurrentId());
						
					}).catch(function(err) {
						n.showAlert(err.message, err.abort ? 'I' : "E");
					});
				})
			);
			
			cont.append(
				Document.getEditorOptionMenuItems(that, {
					noHistory: true,
					noCopy: true,
					noDownload: true
				})
			);
		});
	}
	
	/**
	 * Check basic property correctness
	 */
	static checkBasicProps(doc, errors) {
		if (!doc.attachment_filename) {
			errors.push({
				message: 'attachment_filename missing',
				id: doc._id,
				type: 'E'
			});		
		}
		
		if (!doc._attachments || !doc._attachments[doc.attachment_filename]) {
			errors.push({
				message: 'Attachment data missing',
				id: doc._id,
				type: 'E'
			});		
		}
		
		if (!doc.content_type) {
			errors.push({
				message: 'content_type missing',
				id: doc._id,
				type: 'W'
			});		
		}
		
		if (doc._attachments[doc.attachment_filename].content_type != doc.content_type) {
			errors.push({
				message: 'Attachment mismatching content_types: ' + doc._attachments[doc.attachment_filename].content_type + ' != ' + doc.content_type,
				id: doc._id,
				type: 'E'
			});		
		}
	}
}