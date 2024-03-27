/**
 * Note taking app - Main application controller class.  
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
class Dialog {  
	
	#view = null;
	
	#dialog = null;
	#submitCallback = null;
	#cancelCallback = null;
	

	constructor(view) {
		this.#view = view;
	}
	
	/**
	 * Shows an Ok/Cancel dialog. content is optional.
	 * 
	 * Returns true or false. 
	 * onShownCallback is an optional callback called after the dialog has been shown.
	 */
	async confirm(text, content, onShownCallback) {
		var that = this;
		
		return new Promise(function(resolve) {
			that.show(
				text, 
				content, 
				[
					{
						text: 'Ok',
						type: 'submit',
						callback: function() {
			    			resolve(true);
			    			return true;
						}
					},
					{
						text: 'Cancel',
						type: 'cancel',
						callback: function() {
							resolve(false);
							return true;
						}
					}
				],
				onShownCallback
			);
		});
	}

	/**
	 * Prompt for file(s) to upload.
	 * onShownCallback is an optional callback called after the dialog has been shown.
	 * 
	 * options: {
	 *     onShownCallback: function()
	 *     content: Optional DOM content to be shown under the file input
	 * }
	 */
	async promptFiles(text, options) {
		if (!options) options = {};
		
		var input = $('<input type="file" class="form-control" />');
		
		var that = this;
		return new Promise(function(resolve) {
			that.show(
				text,
				$('<table />').append(
          			$('<tr />').append(
          				$('<td />').append(
							  $('<span />')
							  .text('Upload File')
						),
          				
          				$('<td />').append(
          					input
						)
					),
					
					!options.content ? null : $('<tr />').append(
						$('<td />').append(
							  $('<span />')
							  .text('Options')
						),
          				
          				$('<td />').append(
          					options.content
						)
					)
				),
				[
					{
						text: 'Ok',
						type: 'submit',
						callback: function() {
							if (!input[0].files || !input[0].files.length) {
	    						that.#view.message('Please select a file to upload.', 'E');
								return false;
			    			}
			    
			    			resolve(input[0].files);
			    			return true;
						}
					},
					{
						text: 'Cancel',
						type: 'cancel',
						callback: function() {
							resolve(false);
							return true;
						}
					}
				],
				options.onShownCallback ? options.onShownCallback : null
			)
		});
	}
	
	/**
	 * Cancel the dialog
	 */
	cancel() {
		if (this.#cancelCallback) {
			this.#cancelCallback();
			this.#cancelCallback = null;
		}
	}
	
	/**
	 * Submit the dialog
	 */
	submit() {
		if (this.#submitCallback) {
			this.#submitCallback();
			this.#submitCallback = null;
		}
	}
	
	//////////////////////////////////////////////////////////////////////////////////////////////////////////

	/**
	 * Shows a dialog and returns.
	 */
	show(text, content, buttons, onShownCallback) {
		this.#close();
		
		this.#dialog = $('<div class="modal fade" tabindex="-1" aria-hidden="true" />').appendTo('body');
		
		var buttonDom = this.#createButtons(buttons);
		
		this.#dialog.append(
			$('<div class="modal-dialog modal-lg" />').append(
				$('<div class="modal-content" />').append(
					$('<div class="modal-header" />').append(
						$('<h5 class="modal-title" /></h5>').append(
							$('<span />').text(
								text
							)
						)
					),
					
					!content ? null : $('<div class="modal-body">').append(
						content
					),
					
					$('<div class="modal-footer">').append(
						buttonDom
					)
				)
			)
		)
		.on('hidden.bs.modal', function() {
			that.cancel();
			that.#destroy();
		})
		.on('shown.bs.modal', function() {
			if (onShownCallback) onShownCallback();
		})
		.modal();
		
		var that = this;
		$(document).on('keypress.dialog', function(e) {
		    if (e.which == 13) {
				that.submit();
		    }
		});
	}
	
	///////////////////////////////////////////////////////////////////////////
	
	/**
	 * Remove the dialog from outside (cancel)
	 */
	#close() {
		$(document).unbind('keypress.dialog');
		if (this.#dialog) this.#dialog.modal('hide');
		
		this.#submitCallback = null;
		this.#cancelCallback = null;
	}
	
	/**
	 * Destroy DOM and handlers
	 */
	#destroy() {
		if (this.#dialog) this.#dialog.remove();

		this.#dialog = null;
		this.#submitCallback = null;
		this.#cancelCallback = null;
	}
	
	/**
	 * Creates an array of button elements from the passed definitions.
	 */
	#createButtons(definitions) {
		var ret = [];
		var that = this;
		
		for(var d in definitions) {
			const def = definitions[d];
			
			var attrs = '';
			var text = '';
			
			if (def.type == "cancel") {
				attrs += 'data-dismiss="modal"';
				this.#cancelCallback = function() {
					if (!def.callback()) return;
					that.#close();
				}
			}
			
			if (def.type == "submit") {
				this.#submitCallback = function() {
					if (!def.callback()) return;
					that.#close();
				}
			}
			
			if (def.text) {
				text = def.text;
			}
			
			ret.push(
				$('<button type="button" class="btn btn-secondary" ' + attrs + '>')
				.text(text)
				.on('click', function(e) {
					e.stopPropagation();

					if (def.callback) {
						if (!def.callback(e)) return;
						that.#close();
					}
				})
			);
		}
		
		return ret;
	}
}