/**
 * Image upload/paste/reference dialog for the notes application.
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
class ImageDialog {  
	
	#app = null;
	
	#typeSelect = null;       // Type selector
	#attrs = null;            // Constructor arguments

	// Dynamic lines for inputs deppending on the type 
	#labelLine1 = null;
	#labelLine2 = null;
	#labelLine3 = null;

	#inputLine1 = null;
	#inputLine2 = null;
	#inputLine3 = null;
	
	// Preview elements
	#preview = null;
	#previewInfo = null;
	
	// References for the different types
	#b64dataInput = null;
	#fileUploadInput = null;
	#imageSelector = null;

	
	constructor(app) {
		this.#app = app;
	}
	
	/**
	 * Asks the user for an image, and returns a promise which can be used directly for example as backImage object.
	 * 
	 * {
	 *		doc,          // Document reference      
	 *      displayName,  // Display name for title
	 *		imageData,    // Current image data (optional)
	 *
	 *      // Image properties for rescaling
	 *		maxWidth,     
	 *		maxHeight, 
	 *		mimeType,
	 *		quality, 
	 *		maxBytes,
	 *	}
	 *
	 * Returns an object with the data, depending on the type selected (not the mime type!).
	 */
	async show(attrs) { //doc, displayName, imageData, maxWidth, maxHeight, mimeType, quality, maxBytes) {  TODO cleanup
		this.#attrs = attrs; 
		
		var content = this.#createContent();		
		
		this.#setType(this.#typeSelect.val());

		var answer = await this.#app.view.getDialog().confirm('Set background image for ' + this.#attrs.displayName + ':', [ 
			content 
		]);
		
		if (!answer) {
			this.#reset();
			throw new InfoError('Action canceled');
		}
		
		var ret = await this.#process();
		
		this.#reset();
		
		return ret;
	}
	
	/**
	 * Process the users entries
	 */
	async #process() {
		var mode = this.#typeSelect.val();
		
		switch(mode) {
			// No image
			case 'none': {
				return false;
			}
			
			// Link or data
			case 'url': {
				var b64data = this.#b64dataInput.val();
				if (!b64data || (b64data.length == 0)) throw new InfoError('No base64 data');
				
				var compressed = await Tools.rescaleImage(
					b64data, 
					this.#attrs.maxWidth, 
					this.#attrs.maxHeight, 
					this.#attrs.mimeType, 
					this.#attrs.quality, 
					this.#attrs.maxBytes
				);
				if (!compressed.data) throw new Error("Error rescaling image");
					
				if (b64data != compressed.data) {
					console.log(' -> Item background image rescaled from ' + Tools.convertFilesize(b64data.length) + ' to ' + Tools.convertFilesize(compressed.data.length) + ", new size: " + JSON.stringify(compressed.size));
				} else {
					console.log(' -> Item background image: ' + Tools.convertFilesize(compressed.data.length) + ", size: " + JSON.stringify(compressed.size));
				}
					
				return {
					data: compressed.data,
					size: compressed.size
				}
			}
			
			// Reference document
			case 'ref': {
				var refId = this.#imageSelector.val();
				if (refId == '_cancel') return false;
					
				var data = await this.#app.actions.attachment.getAttachmentUrl(refId)
				var size = await Tools.getImageSize(data.url);
					
				console.log(' -> Image size: ' + JSON.stringify(size));
					
				return {
					ref: refId,
					size: size
				};
			}

			// Upload file					
			case 'upload': {
				var files = this.#fileUploadInput[0].files;
	    		if (!files || !files.length) throw new InfoError('No file selected for upload.');

				var file = files[0];

				var b64data = await Tools.fileToBase64(file);
				var compressed = await Tools.rescaleImage(
					b64data, 
					this.#attrs.maxWidth, 
					this.#attrs.maxHeight, 
					this.#attrs.mimeType, 
					this.#attrs.quality, 
					this.#attrs.maxBytes
				);

				if (!compressed.data) throw new Error("Error rescaling image");
					
				if (b64data != compressed.data) {
					console.log(' -> Item background image rescaled from ' + Tools.convertFilesize(b64data.length) + ' to ' + Tools.convertFilesize(compressed.data.length) + ", new size: " + JSON.stringify(compressed.size));
				} else {
					console.log(' -> Item background image: ' + Tools.convertFilesize(compressed.data.length) + ", size: " + JSON.stringify(compressed.size));
				}

				return {
					data: compressed.data,
					size: compressed.size
				};
			}
			
			default: {
				throw new Error('Invalid image mode: ' + mode);
			}
		}
	}
	
	/**
	 * Resets the instance for further usage
	 */
	#reset() {
		this.#typeSelect = null;
		
		this.#labelLine1 = null;
		this.#labelLine2 = null;
		this.#labelLine3 = null;

		this.#inputLine1 = null;
		this.#inputLine2 = null;
		this.#inputLine3 = null;
		this.#preview = null;
		this.#previewInfo = null;
		
		this.#attrs = null;
		this.#b64dataInput = null;
		this.#fileUploadInput = null;
		this.#imageSelector = null;
		
		$(window).off('.imagedialog');
	}
	
	/**
	 * Create the image type selector and preview etc.
	 */
	#createContent() {
		this.#typeSelect = $('<select />').append(
			$('<option value="none" selected="selected">No image</option>'),
			$('<option value="upload">Upload from File</option>'),
			$('<option value="ref">Image Attachment in Notebook</option>'),
			$('<option value="url">Paste from Clipboard / Web Link</option>'),
		);
		
		if (this.#attrs.imageData) {
			if (this.#attrs.imageData.hasOwnProperty('data')) {
				this.#typeSelect.val('url');
			}
			if (this.#attrs.imageData.hasOwnProperty('ref')) {
				this.#typeSelect.val('ref');
			}
		} 

		this.#preview = $('<img class="setBgImageDialogInputPreviewImg" alt="No Preview available" />');
		this.#previewInfo = $('<div class="setBgImageDialogInputPreviewInfo" />');	
			
		this.#inputLine1 = $('<td />');
		this.#inputLine2 = $('<td />');
		this.#inputLine3 = $('<td />');
		
		this.#labelLine1 = $('<td />');
		this.#labelLine2 = $('<td />');
		this.#labelLine3 = $('<td />');

		var that = this;
		return $('<table class="dialogTable" />').append(
			$('<colgroup />').append(
				$('<col span="1" style="width: 15%;">'),
				$('<col span="1" style="width: 70%;">')
			),
			
      		$('<tbody />').append(
          		$('<tr />').append(
          			$('<td />')
          			.text('Source'),
          			
          			$('<td />').append(
          				this.#typeSelect
						.on('change', function() {
							that.#setType($(this).val());
						})
          			)
          		),
          		
          		$('<tr />').append(
          			this.#labelLine1,
          			this.#inputLine1
          		),
          		$('<tr />').append(
          			this.#labelLine2,
          			this.#inputLine2
          		),
          		$('<tr />').append(
          			this.#labelLine3,
          			this.#inputLine3
          		),
          		$('<tr />').append(
          			$('<td />'),
          			$('<td />').append(
						this.#preview,
						this.#previewInfo
					)
          		),
          			
      		)
      	);
	}
	
	/**
	 * Update inputs according to the currently selected type
	 */
	#setType(type) {
		this.#typeSelect.val(type);

		var that = this;
		
		this.#inputLine1.empty();
		this.#inputLine2.empty();
		this.#inputLine3.empty();
		
		this.#b64dataInput = null;
			
		this.#updatePreview();
			
		var name = "";
		var nameLine2 = "";
		var nameLine3 = "";

		switch (type) {
			case 'none': {
				break;
			}
			
			case 'url': {
				name = 'URL (or data)';
				
				var val = this.#attrs.imageData ? (this.#attrs.imageData.data ? this.#attrs.imageData.data : '') : '';
				
				this.#b64dataInput = $('<textarea />')
				.on('focus change keyup paste', function() {
					that.#updatePreviewRescaled($(this).val());
				})
				.val(val);
				
				this.#inputLine1.append(
					this.#b64dataInput
				);
				
				$(window).on('paste.imagedialog', function(e) {
					that.#handlePaste(e);
				});
				
				this.#updatePreviewRescaled(val);
				break;
			}
				
			case 'ref': {
				name = 'Attachment Document';
					
				this.#imageSelector = this.#app.view.getBackgroundImageSelector();
				
				this.#imageSelector.css('max-width', '100%');
				this.#imageSelector.val(this.#attrs.imageData ? (this.#attrs.imageData.ref ? this.#attrs.imageData.ref : '_cancel') : '_cancel');
				
				this.#imageSelector.on('change', function() {
					var val = $(this).val();
					that.#onRefSelectorChange(val);
				});
				
				this.#onRefSelectorChange(this.#imageSelector.val());
						
				this.#inputLine1.append(this.#imageSelector);
					
				this.#imageSelector.selectize({
					sortField: 'text'
				});

				nameLine2 = '';
				this.#inputLine2.append(
					$('<a href="javascript:void(0)">Convert to data...</a>')
					.on('click', function() {
						var oldmode = that.#imageSelector.val();
							
						that.#setType('url');
						that.#convertToDataHandler(oldmode);
					})
				);

				if (Document.isImage(this.#attrs.doc)) {
					nameLine3 = 'Use attached image';
					
					this.#inputLine3.append(
						$('<input class="checkbox-switch" type="checkbox" />')  // setBgImageDialogRefSelfInput
						.each(function() {
							var that2 = this;
							setTimeout(function() {
								try {
									new Switch(that2, {
										size: 'small',
										onSwitchColor: '#337ab7',
										disabled:  false,
										onChange: function() {
											var checked = !!this.getChecked();
											var sel = that.#imageSelector.prop('selectize');
											if (!sel) return;
												
											if (checked) {
												sel.setValue(doc._id);
												sel.disable();
											} else {
												sel.enable();
											}
											that.#onRefSelectorChange(that.#attrs.doc._id);
										}
									});
								} catch (cx) {}
							}, 0);
						})
					);
				}
				
				break;
			}
			
			case 'upload': {
				name = 'URL';
			
				this.#fileUploadInput = $('<input type="file" class="form-control" />');
			
				this.#inputLine1.append(
					this.#fileUploadInput 
					.on('change', function() {
						that.#handleFileUploadInput();
					})
				);
				
				break;
			}
			
			default: {
				return;
			}
		}
		
		this.#labelLine1.html(name);
		this.#labelLine2.html(nameLine2);
		this.#labelLine3.html(nameLine3);
	}
	
	/**
	 * File upload handler
	 */
	async #handleFileUploadInput() {
		var files = this.#fileUploadInput[0].files;

		if (!files || !files.length) {
			this.#updatePreview();
			return;
	    }
	    
		var b64data = await Tools.fileToBase64(files[0]);

		this.#updatePreviewRescaled(b64data);
	}
						
	/** 
	 * For reference changes. 
	 */
	async #onRefSelectorChange(val) {
		if (val == '_cancel') {
			this.#inputLine2.css('display', 'none');
			this.#updatePreview();
		} else {
			this.#inputLine2.css('display', 'block');

			try {
				var data = await this.#app.actions.attachment.getAttachmentUrl(val);

				this.#updatePreview(data.url, false, false, false, 'Reference (used as is)');
				
			} catch (err) {
				// Not handled on purpose
			}
		}
	}

	/**
	 * Handler for convert to data function
	 */
	async #convertToDataHandler(oldmode) {
		try {
			var data = await this.#convertRefToData(oldmode);
			var dataurl = await Tools.fileToBase64(data.blob);
			
			this.#b64dataInput.val(dataurl);
									
			this.#updatePreviewRescaled(dataurl);
			
		} catch(err) {
			this.#app.errorHandler.handle(err);
		}
	}
	
	/**
	 * Returns a Promise containing the data string of the referenced attachment document.
	 */
	async #convertRefToData(idToConvert) {
		this.#app.view.message('Converting to data...', 'I');
			
		var data = await this.#app.actions.attachment.getAttachmentUrl(idToConvert);
				
		if (data.url) {
			return data;
		} 
		
		throw new Error("Could not load referenced attachment: " + idToConvert);
	}
	
	/**
	 * Handler for window paste
	 */
	async #handlePaste(event) {
		try {
			var data = await Tools.getClipboardImageData(event);
		
			this.#b64dataInput.val(data);
			
		} catch(err) {
			// Unhandled on purpose to not distract too much (this also fires when no clipboard is available) 
		}
	}
	
	/** 
	 * For data changes. 
	 */
	async #updatePreviewRescaled(valP) {
		try {
			var compressed = await Tools.rescaleImage(
				valP, 
				this.#attrs.maxWidth, 
				this.#attrs.maxHeight, 
				this.#attrs.mimeType,
				this.#attrs.quality, 
				this.#attrs.maxBytes
			);
				
			this.#updatePreview(compressed.data, compressed.size, valP, false);
			
		} catch(err) {
			this.#updatePreview('', false, false, false, 'Error: ' + (err ? err.message : 'Unknown error'));
		}
	}
		
	/**
	 * Updates the preview area.
	 */
	#updatePreview(data, size, origData, origSize, overrideText) {
		// Image preview
		if (!data || (data == '_cancel')) {
			this.#preview.prop('src', '');
			this.#previewInfo.html(overrideText ? overrideText : '');
			return;
		}
		this.#preview.prop('src', data);

		// Info text			
		var text = "";
		if (overrideText) {
			text = overrideText;
		} else {
			if (data) {
				if (origData && (data == origData)) {
					text += 'Unscaled: ';
				} else {
					text += 'Rescaled: '; 
				}
				
				if (size) {
					text += Math.ceil(size.width) + ' x ' + Math.ceil(size.height) + ' Pixels, Size: ' + Tools.convertFilesize(data.length);
				} else {
					text += 'Size: ' + Tools.convertFilesize(data.length);
				}
			}
			if (origData && (data != origData)) {
				text += '<br>Original: ';
				if (origSize) {
					text += Math.ceil(origSize.width) + ' x ' + Math.ceil(origSize.height) + ' Pixels, Size: ' + Tools.convertFilesize(origData.length);
				} else {
					text += 'Size: ' + Tools.convertFilesize(origData.length);
				}
			}
		}
		
		this.#previewInfo.html(text);
	}
}
	