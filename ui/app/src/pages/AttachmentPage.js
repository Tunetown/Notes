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
class AttachmentPage extends Page {
	
	#current = null;        // Current data
	
	/**
	 * PDFs do not support focussing, so we deactivate that completely for attachments.
	 */
	overrideFocusId() {
		return Notes.FOCUS_ID_EDITOR;
	}
	
	/**
	 * Must return true if linkage from navigation to this page is supported.
	 * If so, this class must implement an updateFromLinkage(id) instance method!
	 * 
	 * TODO still necessary?
	 */
	supportsLinkageFromNavigation() {
		return true;
	}
	
	/**
	 * Update the content from navigation if enabled.
	 * 
	 * TODO still necessary?
	 */
	updateFromLinkage(id) {
		// In this case, just redirect to the document.
		this._app.routing.call(id);
	}
	
	/**
	 * Hides all option menus for the editor TODO cleanup
	 *
	hideOptions() {
		this._app.hideMenu();
	}
	
	/**
	 * Returns the ID of the loaded note, if any, or false if none is loaded.
	 */
	getCurrentId() {
		return this.#current ? this.#current.doc._id : false;
	}

	/**
	 * Returns the ID of the loaded note, if any, or false if none is loaded.
	 */
	getCurrentDoc() {
		return this.#current ? this.#current.doc : null;
	}
		
	/**
	 * Reset the "currently shown" flags
	 */
	async unload() {
		this.#current = null;
		
		this._tab.getContainer().empty();
	}
	
	/**
	 * Loads the passed version history data into the versions view.
	 * 
	 * { doc: doc, url: url }
	 */
	async load(data) {
		var that = this;
		
		await this.unload();
		
		this._app.setButtons([ 
			$('<div type="button" data-toggle="tooltip" title="Download ' + data.doc.name + '" id="dnldButton" class="fa fa-download"></div>')
			.on('click', function(event) {
				event.stopPropagation();
				that.#download();
			}),
			$('<div type="button" data-toggle="tooltip" title="Options..." id="editorOptionsButton" class="fa fa-ellipsis-v"></div>')
			.on('click', function(event) {
				event.stopPropagation();
				that.#callPageOptions(event);
			}),
		]);		
		
		var atts = Document.getAttachments(data.doc);
		if (!atts) {
			this._app.showAlert('Document ' + data.doc.name + ' has no attachments');
			return;
		}
		var att = atts['attachment_data'];
		if (!att) att = atts[data.doc.attachment_filename];
		 
		var attsize = Tools.convertFilesize(att.length);
		
		// Set note name in the header
		this._app.setStatusText(data.doc.name + ' (' + attsize + ')');
		this._app.allowViewportScaling(true);

		if (!data.doc.content_type || data.doc.content_type.startsWith('text/')) {
			// Interpret as text: Load content and show in text area
			$.ajax({
				url: url, 
				type: "get",
				dataType: "text",
				
				success: function( response ) {
					// Show in pre tag
					this._tab.getContainer().append(
						$('<textarea readonly class="preview textpreview">' + response + '</textarea>')
					);
				},
			})
			.fail(function(response, status, error) {
				that._app.showAlert('Server error ' + response.status + ': Please see the logs.');
			});
		} else {
			// Try object tag to embed the content (for pdf/mp3/...)
			this._tab.getContainer().append(
				$('<object class="preview" data="' + data.url + '#toolbar=0&navpanes=0&scrollbar=0" type="' + data.doc.content_type + '" ><span id="previewteaser">Preview not available</span></object>')
			);
		}
		
		this.#current = data;
	}
	
	////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	
	/**
	 * Check basic property correctness 
	 * 
	 * TODO solve otherwise
	 */
	static checkBasicProps(doc, errors) {
		if (doc.type != 'attachment') return;
		
		if (!doc.attachment_filename) {
			errors.push({
				message: 'attachment_filename missing',
				id: doc._id,
				type: 'E'
			});		
		}
		
		if (!doc._attachments) {
			errors.push({
				message: 'No attachment data',
				id: doc._id,
				type: 'E'
			});		
			return;
		}
		
		var attname = 'attachment_data';
		if (!doc._attachments[attname]) {
			if (doc._attachments[doc.attachment_filename]) {
				attname = doc.attachment_filename;
				
				errors.push({
					message: 'Attachment uses deprecated name: ' + doc.attachment_filename + '. Re-upload it to solve this.',
					id: doc._id,
					type: 'I'
				});		
			} else {
				errors.push({
					message: 'Attachment data missing',
					id: doc._id,
					type: 'E'
				});		
			}
		}
		
		if (!doc.content_type) {
			errors.push({
				message: 'Document content_type missing',
				id: doc._id,
				type: 'W'
			});		
		}
		
		if (doc._attachments[attname] && (doc._attachments[attname].content_type != doc.content_type)) {
			errors.push({
				message: 'Attachment mismatching content_types: ' + doc._attachments[attname].content_type + ' != ' + doc.content_type,
				id: doc._id,
				type: 'E'
			});		
		}
	}
	
	////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	
	/**
	 * Download the shown attachment.
	 */
	#download() {
		if (!this.#current) return;
		
		var that = this;
		this._app.actions.attachment.getAttachmentUrl(this.#current.doc._id)
		.then(function(data) {
			if (!data.ok || !data.url) {
				that._app.showAlert(data.message ? data.message : 'Error downloading attachment', 'E', data.messageThreadId);
			}
			
			window.saveAs(data.url, that.#current.doc.name);
		})
		.catch(function(err) {
			that._app.showAlert('Error downloading attachment: ' + err.message, 'E', err.messageThreadId);
		});
	}
	
	/**
	 * Calls the options of the attachment
	 */
	#callPageOptions(event) {
		event.stopPropagation();
		
		var that = this;
		
		this._app.showMenu('attachmentOptions', function(cont) {
			cont.append(
				$('<div class="userbutton"><div class="fa fa-exchange-alt userbuttonIcon"></div>Update from File</div>')
				.on('click', function(event) {
					event.stopPropagation();
					that._app.hideOptions();	
					
					that._app.actions.attachments.updateAttachmentFromFile(that.getCurrentId())
					.then(function(data) {
						if (data.message) {
							that._app.showAlert(data.message, "S", data.messageThreadId);
						}
						
						that._app.routing.call(that.getCurrentId());
						
					}).catch(function(err) {
						that._app.showAlert(err.message, err.abort ? 'I' : "E", err.messageThreadId);
					});
				})
			);
			
			cont.append(
				new PageMenu(that._app).get(that, {
					noHistory: true,
					noCopy: true,
					noDownload: true
				})
			);
		});
	}
}