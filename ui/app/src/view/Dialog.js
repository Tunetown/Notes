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
	
	constructor(view) {
		this.#view = view;
	}
	
	/**
	 * Shows an Ok/Cancel dialog. content is optional.
	 * Returns true or false.
	 */
	async prompt(text, content) {
		var that = this;
		
		return new Promise(function(resolve) {
			that.#create(
				text, 
				content, 
				[
					{
						text: 'Ok',
						type: 'submit',
						callback: function() {
							that.close();
			    			resolve(true);
						}
					},
					{
						text: 'Cancel',
						type: 'cancel',
						callback: function() {
			    			that.close();
							resolve(false);
						}
					}
				]
			);
		});
	}

	/**
	 * Prompt for file(s) to upload
	 */
	async promptFiles(text) {
		var that = this;
		
		var input = $('<input type="file" class="form-control" />');
		
		return new Promise(function(resolve) {
			that.#create(
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
					)
				),
				[
					{
						text: 'Ok',
						type: 'submit',
						callback: function() {
							that.close();
							
							if (!input[0].files) {
	    						that.#view.message('Please select a file to upload.', 'E');
								return;
			    			}
			    
			    			resolve(input[0].files);
						}
					},
					{
						text: 'Cancel',
						type: 'cancel',
						callback: function() {
			    			that.close();
							resolve(false);
						}
					}
				]
			)
		});
	}
	
	/**
	 * Remove the dialog from outside
	 */
	close() {
		$(document).unbind('keypress.dialog');
		if (this.#dialog) this.#dialog.modal('hide');
	}
	
	//////////////////////////////////////////////////////////////////////////////////////////////////////////

	#dialog = null;
	#submitCallback = null;
	#cancelCallback = null;
	
	/**
	 * Create the dialog DOM
	 */
	#create(text, content, buttons) {
		this.close();
		
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
			if (that.#cancelCallback) that.#cancelCallback();
			that.#destroy();
		})
		.modal();
		
		var that = this;
		$(document).on('keypress.dialog', function(e) {
		    if (e.which == 13) {
				if (that.#submitCallback) {
					that.#submitCallback();
					that.close();
				}
		    }
		});
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
		
		for(var d in definitions) {
			const def = definitions[d];
			
			var attrs = '';
			var text = '';
			
			if (def.type == "cancel") {
				attrs += 'data-dismiss="modal"';
				this.#cancelCallback = def.callback;
			}
			if (def.type == "submit") {
				this.#submitCallback = def.callback;
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
						def.callback(e);
					}
				})
			);
		}
		
		return ret;
	}
}