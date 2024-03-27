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
class CreateDialog {  
	
	#app = null;
	
	#refSelector = null;
	#typeSelector = null;
	
	#selectTypeContainer = null;
	#createNameInput = null;
	#createWarnIcon = null;
	#createWarnText = null;
	#uploadLabel = null;
	#customFile = null;
	#refLabel = null;
	#refCell = null;
	
	#createTimeoutHandler = null;
	
	constructor(app) {
		this.#app = app;
	}
	
	/**
	 * Asks the user for type and name of the new document.
	 * 
	 * Returns: { 
	 *		ok,  (bool)
	 *		name,
	 *		type,
	 *		files,
	 *		refTarget
	 * }
	 */
	async show(question) { 
		this.#app.data.resetChildrenBuffers();
		
		var content = this.#createContent();		
		
		this.#setType(this.#typeSelector.val());

		var that = this;
		var answer = await this.#app.view.getDialog().confirm(
			question, 
			content, 
			function() {  // onShown
				that.#createNameInput.focus();
			}
		);
		
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
		var name = this.#createNameInput.val();

		var type = this.#typeSelector.val();
		if (!type) throw new Error('Please specify a type for the new document.');
			   
		var files = null; 
		var refTarget = null;
			   
		switch (type) {
			case 'attachment': {
				files = this.#customFile[0].files;
	    		if (!files || !files.length) throw new Error('Please select a file to upload.');
	    		
	    		var maxMB = parseFloat(this.#app.settings.settings.maxUploadSizeMB);
	    		if (maxMB) {
		    		for(var f in files) {
			    		if (files[f].size > (maxMB * 1024 * 1024)) {
			    			throw new Error('The file ' + files[f].name + 'is too large: ' + Tools.convertFilesize(files[f].size) + '. You can change this in the settings.');
			    		}
		    		}
	    		}
	    		
	    		if (files && (files.length >= 5)) {
	    			if (!confirm('You are about to upload ' + files.length + ' documents, do you want to proceed?')) {
	    				throw new InfoError('Action canceled');
	    			}
			    }
			    
			    break;
			}
		    		
		    		
		    case 'reference': {
	    		if (!name) {
	    			this.#app.view.message('Please specify a name for the new document.', 'E');
					return;
			    }
	    		
	    		refTarget = this.#refSelector.val();
	    		
	    		if (!refTarget) {
	    			throw new Error('Please specify target for the reference document.');
	    		}
	    		
	    		break;
	    	}
	    		
			default: {
	    		if (!name) {
	    			throw new Error('Please specify a name for the new document.');
			    }
	    	}
		}	
		    	
    	return { 
			ok: true,
			name: name,
			type: type,
			files: files,
			refTarget: refTarget
		};
	}
	
	/**
	 * Resets the instance for further usage
	 */
	#reset() {
		this.#refSelector = null;
		this.#typeSelector = null;
		
		this.#selectTypeContainer = null;
		this.#createNameInput = null;
		this.#createWarnIcon = null;
		this.#createWarnText = null;
		this.#uploadLabel = null;
		this.#customFile = null;
		this.#refLabel = null;
		this.#refCell = null;
		
		this.#createTimeoutHandler = null;
	}
	
	/**
	 * Create the image type selector and preview etc.
	 */
	#createContent() {
		var that = this;
		
		var existingRefs = [];
		this.#app.data.each(function(doc) {
			if (doc.type == 'reference') existingRefs.push(doc._id);
		});
		
		this.#refSelector = this.#app.view.getDocumentSelector(existingRefs, true)
		.on('change', function() {
			if (that.#typeSelector.val() == 'reference') {
				var tdoc = that.#app.data.getById(this.value);
				if (tdoc) {
					that.#createNameInput.val(tdoc.name);
				}
			}
		});
		
		this.#refSelector.val('');
		
		this.#typeSelector = Document.getAvailableTypeSelect()
		.on('change', function() {
			that.#setType(this.value);
		})

		this.#selectTypeContainer = $('<td />').append(
			this.#typeSelector
		);
		
		this.#createWarnIcon = $('<div class="fa fa-exclamation iconOrange" />')
		.css('display', 'none');
		
		this.#createWarnText = $('<div class="iconOrange" />')
		.text('This Name already exists in the notebook. You can create documents with identical names, however it can be confusing when searching documents.')
		.css('display', 'none');
		
		this.#createNameInput = $('<input type="text" />')
		.on('input', function() {
			var val = $(this).val();
			
			if ((that.#typeSelector.val() == 'reference') || !val || !val.length) {
				that.#createWarnIcon.css('display', 'none');
				that.#createWarnText.css('display', 'none');
				return;
			}

			if (that.#createTimeoutHandler) clearTimeout(that.#createTimeoutHandler);
			that.#createTimeoutHandler = setTimeout(function() {
				if (!that.#createWarnIcon) return;
				
				var ex = that.#app.data.documentNameExists(val);
				
				that.#createWarnIcon.css('display', ex ? 'inline-block' : 'none');
				that.#createWarnText.css('display', ex ? 'inline-block' : 'none');
			}, 300);   // TODO put to Config
		});
			
		this.#uploadLabel = $('<span />');
		this.#customFile = $('<input type="file" class="form-control" multiple />');
		this.#refLabel = $('<span />');

		this.#refCell = $('<div />').append(
			this.#refSelector
		);
		
		return $('<table class="dialogTable" />').append(
			$('<colgroup />').append(
				$('<col span="1" style="width: 15%;">'),
				$('<col span="1" style="width: 70%;">')
			),
			
      		$('<tbody />').append(
          		$('<tr />').append(
          			$('<td />')
          			.text('Name'),
          			
          			$('<td />').append(
          				this.#createNameInput,              
          				this.#createWarnIcon, 
          				this.#createWarnText
          			)
          		),
          		
          		$('<tr />').append(
          			$('<td />')
          			.text('Type'),
          			
          			this.#selectTypeContainer
          		),
          		
          		$('<tr />').append(
          			$('<td />').append(
						  this.#uploadLabel 
						  .text('Upload File')
					),
					
          			$('<td />').append(
          				this.#customFile 
		            )
          		),
          		
          		$('<tr />').append(
          			$('<td />').append(
						  this.#refLabel 
						  .text('Reference to')
					),
					
          			$('<td />').append(
          				this.#refCell 
		            )
          		)
      		)
      	);
	}
	
	/**
	 * Update inputs according to the currently selected type
	 */
	#setType(type) {
		this.#typeSelector.val(type);

		this.#uploadLabel.css('display', (type == "attachment") ? 'inherit' : 'none');
		this.#customFile.css('display', (type == "attachment") ? 'inherit' : 'none');
		this.#createNameInput.prop('disabled', (type == "attachment"));
			
		this.#refLabel.css('display', (type == 'reference') ? 'inherit' : 'none');
		this.#refCell.css('display', (type == 'reference') ? 'block' : 'none');
			
		const cdoc = this.#app.paging.getCurrentlyShownDoc();
		if (cdoc && (type == 'reference')) {
			this.#createNameInput.val(cdoc.name);
		}
			
		if (type == 'attachment') {
			this.#createNameInput.val('');
		}
		
		this.#createNameInput.triggerHandler('input');
		
		// Enable searching by text entry  TODO does this work before appending to DOM??
		this.#refSelector.selectize({
			sortField: 'text'
		});
	}
}
	