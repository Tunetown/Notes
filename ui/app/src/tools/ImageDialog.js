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
	
	constructor(app) {
		this.#app = app;
	}
	
	/**
	 * Asks the user for an image, and returns a promise which can be used directly for example as backImage object.
	 */
	askForImage(doc, displayName, imageData, maxWidth, maxHeight, type, quality, maxBytes) {
		// Preview element
		$('#setBgImageDialogInputPreview').empty();
		var preview = $('<img class="setBgImageDialogInputPreviewImg" alt="No Preview available"></img>');	
		var previewInfo = $('<div class="setBgImageDialogInputPreviewInfo"></div>');	
		$('#setBgImageDialogInputPreview').append(
			preview,
			previewInfo
		);

		/**
		 * Enables to paste files from the clipboard (from Greenshot for example)
		 */
		function pasteHandler(event) {
			Tools.getClipboardImageData(event)
			.then(function(data) {
				$('#setBgImageDialogB64DataInput').val(data);
			})
			.catch(function(err) {
			});
		}

		/**
		 * Returns a Promise containing the data string of the referenced attachment document.
		 */
		function convertRefToData(idToConvert) {
			Notes.getInstance().showAlert('Converting to data...', 'I', 'SetItemBgImageMessages');
			
			return AttachmentActions.getInstance().getAttachmentUrl(idToConvert)
			.then(function(data) {
				if (data.url) {
					return Promise.resolve(data);
				} else {
					return Promise.reject({
						message: "Could not load referenced attachment: " + idToConvert,
						messageThreadId: 'SetItemBgImageMessages',
						abort: true
					});
				}
			})
			.catch(function(err) {
				if (!err) err = {};
				err.abort = true;
				return Promise.reject(err);
			});
		}

		/**
		 * Updates the preview area.
		 */
		function updatePreview(data, size, origData, origSize, overrideText) {
			// Image preview
			if (!data || (data == '_cancel')) {
				preview.prop('src', '');
				previewInfo.html(overrideText ? overrideText : '');
				return;
			}
			preview.prop('src', data);

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
			previewInfo.html(text);
		}
		
		/** 
		 * For reference changes. 
		 */
		function onRefSelectorChange(val) {
			if (val == '_cancel') {
				$('#setBgImageDialogInputSrcInLine2').css('display', 'none');
				updatePreview();
			} else {
				$('#setBgImageDialogInputSrcInLine2').css('display', 'block');

				AttachmentActions.getInstance().getAttachmentUrl(val)
				.then(function(data) {
					updatePreview(data.url, false, false, false, 'Reference (used as is)');
				})
				.catch(function() {
				});
			}
		}

		/** 
		 * For data changes. 
		 */
		function updatePreviewRescaled(valP) {
			Tools.rescaleImage(valP, maxWidth, maxHeight, type, quality, maxBytes)
    		.then(function(compressed) {
				updatePreview(compressed.data, compressed.size, valP, false);
			})
			.catch(function (err) {
				updatePreview('', false, false, false, 'Error: ' + (err ? err.message : 'Unknown error'));
			});
		}

		/**
		 * Set up all inputs, depending on the mode.
		 */
		function setupInputs(mode) {
			$('#setBgImageDialogInputSrcIn').empty();
			$('#setBgImageDialogInputSrcInLine2').empty();
			$('#setBgImageDialogInputSrcInLine3').empty();
			
			updatePreview();
			
			var name = "";
			var nameLine2 = "";
			var nameLine3 = "";
			switch (mode) {
				case 'none': {
					name = '';
					updatePreview();
					break;
				}
				case 'url': {
					name = 'URL (or data)';
					var val = imageData ? (imageData.data ? imageData.data : '') : '';
					$('#setBgImageDialogInputSrcIn').append(
						$('<textarea id="setBgImageDialogB64DataInput"></textarea>')
						.on('focus change keyup paste', function(/*event*/) {
							updatePreviewRescaled($(this).val());
						})
						.val(val)
					);
					window.addEventListener("paste", pasteHandler, false);
					updatePreviewRescaled(val);
					break;
				}
				case 'ref': {
					name = 'Attachment Document';
					
					var selector = Notes.getInstance().getBackgroundImageSelector();
					selector.css('max-width', '100%');
					selector.attr('id', 'setBgImageDialogRefIdInput');
					selector.val(imageData ? (imageData.ref ? imageData.ref : '_cancel') : '_cancel');
					selector.on('change', function(/*event*/) {
						var val = $(this).val();
						onRefSelectorChange(val);
					})
					onRefSelectorChange(selector.val());
						
					$('#setBgImageDialogInputSrcIn').append(selector);
					
					selector.selectize({
						sortField: 'text'
					});

					nameLine2 = '';
					$('#setBgImageDialogInputSrcInLine2').append(
						$('<a href="javascript:void(0)">Convert to data...</a>')
						.on('click', function(event) {
							var oldmode = selector.val();
							
							$('#setBgImageDialogTypeSelector').val('url');
							setupInputs('url');
							
							convertRefToData(oldmode)
							.then(function(data) {
								return Tools.fileToBase64(data.blob);
							})
							.then(function(dataurl) {
								$('#setBgImageDialogB64DataInput').val(dataurl);
								//updatePreview(dataurl);
								updatePreviewRescaled(dataurl);
							})
							.catch(function(err) {
								if (err && err.message) {
									Notes.getInstance().showAlert(err.message, "E", err.messageThreadId);
								} else {
									Notes.getInstance().showAlert("Error converting image", "E", 'SetItemBgImageMessages');
								}
							});
						})
					);

					if (Document.isImage(doc)) {
						nameLine3 = 'Use attached image';
						$('#setBgImageDialogInputSrcInLine3').append(
							$('<input class="checkbox-switch" type="checkbox" id="setBgImageDialogRefSelfInput" />')
							.each(function(i) {
								var that = this;
								setTimeout(function() {
									try {
										new Switch(that, {
											size: 'small',
											onSwitchColor: '#337ab7',
											disabled:  false,
											onChange: function() {
												var checked = !!this.getChecked();
												var sel = selector.prop('selectize');
												if (!sel) return;
													
												if (checked) {
													sel.setValue(doc._id);
													sel.disable();
												} else {
													sel.enable();
												}
												onRefSelectorChange(doc._id);
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
					$('#setBgImageDialogInputSrcIn').append(
						$('<input type="file" class="form-control" id="setBgImageDialogFileUploadInput" />')
						.on('change', function() {
							var files = $('#setBgImageDialogFileUploadInput')[0].files;
				    		if (!files || !files.length) {
								updatePreview();
								return;
						    }
							Tools.fileToBase64(files[0])
							.then(function(b64data) {
								updatePreviewRescaled(b64data);
								//updatePreview(b64data);
							});
						})
					);
					break;
				}
				default: {
					return;
				}
			}
			$('#setBgImageDialogInputName').html(name);
			$('#setBgImageDialogInputNameLine2').html(nameLine2);
			$('#setBgImageDialogInputNameLine3').html(nameLine3);
		}
		
		$('#setBgImageDialogTypeSelector')
		.on('change', function(/*event*/) {
			setupInputs($(this).val());
		});
		
		if (imageData) {
			if (imageData.hasOwnProperty('data')) {
				$('#setBgImageDialogTypeSelector').val('url');
			}
			if (imageData.hasOwnProperty('ref')) {
				$('#setBgImageDialogTypeSelector').val('ref');
			}
		} 
		
		setupInputs($('#setBgImageDialogTypeSelector').val());
		
		$('#setBgImageDialogSubmitButton').html('Set');
		
		//var that = this;
		return new Promise(function(resolve, reject) {
			$('#setBgImageDialogSubmitButton').off('click');
			$('#setBgImageDialogSubmitButton').on('click', function(event) {
				$('#setBgImageDialog').off('hidden.bs.modal');
	        	$('#setBgImageDialog').modal('hide');
				window.removeEventListener("paste", pasteHandler);

				var mode = $('#setBgImageDialogTypeSelector').val();
				switch(mode) {
					// No image
					case 'none': {
						resolve(false);
						return;
					}
					
					// Link or data
					case 'url': {
						var b64data = $('#setBgImageDialogB64DataInput').val();

						if (!b64data || (b64data.length == 0)) {
							resolve(false);
							return;
						}
						
						Tools.rescaleImage(b64data, maxWidth, maxHeight, type, quality, maxBytes)
			        	.then(function(compressed) {
							if (!compressed.data) {
								reject({
									message: "Error rescaling image",
									messageThreadId: 'SetItemBgImageMessages',
									abort: true
								});
							}
							
							if (b64data != compressed.data) {
								console.log(' -> Item background image rescaled from ' + Tools.convertFilesize(b64data.length) + ' to ' + Tools.convertFilesize(compressed.data.length) + ", new size: " + JSON.stringify(compressed.size));
							} else {
								console.log(' -> Item background image: ' + Tools.convertFilesize(compressed.data.length) + ", size: " + JSON.stringify(compressed.size));
							}
							
							resolve({
								data: compressed.data,
								size: compressed.size
							});
			        	});
						return;
					}
					
					// Reference document
					case 'ref': {
						var refId = $('#setBgImageDialogRefIdInput').val();
						if (refId == '_cancel') {
							resolve(false);
							return;
						}
							
						AttachmentActions.getInstance().getAttachmentUrl(refId)
						.then(function(data) {
							return Tools.getImageSize(data.url);
						})
						.then(function(size) {
							console.log(' -> Image size: ' + JSON.stringify(size));
							
							resolve({
								ref: refId,
								size: size
							});
			        	});
						return;
					}

					// Upload file					
					case 'upload': {
						var files = $('#setBgImageDialogFileUploadInput')[0].files;
		    		
			    		if (!files || !files.length) {
			    			Notes.getInstance().showAlert('No file selected for upload.', 'E', 'SetItemBgImageMessages');
							return;
					    }
	
						var file = files[0];
			    		
						var b64data_;
						Tools.fileToBase64(file)
						.then(function(b64data) {
							b64data_ = b64data;
							return Tools.rescaleImage(b64data, maxWidth, maxHeight, type, quality, maxBytes);
						})
			        	.then(function(compressed) {
							if (!compressed.data) {
								reject({
									message: "Error rescaling image",
									messageThreadId: 'SetItemBgImageMessages',
									abort: true
								});
							}
							
							if (b64data_ != compressed.data) {
								console.log(' -> Item background image rescaled from ' + Tools.convertFilesize(b64data_.length) + ' to ' + Tools.convertFilesize(compressed.data.length) + ", new size: " + JSON.stringify(compressed.size));
							} else {
								console.log(' -> Item background image: ' + Tools.convertFilesize(compressed.data.length) + ", size: " + JSON.stringify(compressed.size));
							}

							resolve({
								data: compressed.data,
								size: compressed.size
							});
			        	});
						
						return;
					}
					
					default: {
						reject({
							abort: true,
							message: 'Invalid image mode: ' + mode,
							messageThreadId: 'SetItemBgImageMessages'
						});
						return;
					}
				}
			});
			
			$('#setBgImageDialog').off('hidden.bs.modal');
			$('#setBgImageDialog').on('hidden.bs.modal', function () {
				window.removeEventListener("paste", pasteHandler);
				reject({
					abort: true,
					message: 'Action cancelled.',
					messageThreadId: 'SetItemBgImageMessages'
				});
			});
			
			$('#setBgImageDialogText').text('Set background image for ' + displayName + ':');
			$('#setBgImageDialog').modal();
		});
	}
}
	