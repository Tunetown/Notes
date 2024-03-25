/**
 * Raw JSON view
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
class RawPage extends Page {
	
	#current = null;
	#editor = null;
	
	/**
	 * Returns the ID of the loaded note, if any, or false if none is loaded.
	 */
	getCurrentId() {
		return this.#current ? this.#current._id : false;
	}

	/**
	 * Returns the ID of the loaded note, if any, or false if none is loaded.
	 */
	getCurrentDoc() {
		return this.#current ? this.#current : null;
	}
	
	/**
	 * Unload instance
	 */
	async unload() {
		this.#current = null;
	}
	
	/**
	 * Loads the passed version history data into the versions view. doc is a cdb document
	 */
	async load(doc) {
		this.#current = doc;
		
		this._tab.setStatusText("Raw JSON data: " + doc._id);
		
		var docToShow = doc;
		if (Document.isTypeValid(doc.type)) docToShow = Document.clone(doc);
		
		this.#editor = CodeMirror(this._tab.getContainer()[0], {  // Check if works
			value: JSON.stringify(doc, null, 4),
			mode:  'javascript',
			lineNumbers: true
		});
		
		var that = this;
		this.#editor.on('focus', function(/*obj*/) {
			that._app.hideOptions();
		});
		
		// Buttons
		this._app.setButtons([ 
			$('<div type="button" data-toggle="tooltip" title="Back to standard editor" class="fa fa-times"></div>')
			.on('click', function(event) {
				event.stopPropagation();
				that.#back();
			}),
			
			$('<div type="button" data-toggle="tooltip" title="Save" class="fa fa-save"></div>')
			.on('click', function(event) {
				event.stopPropagation();
				that.#save();
			}),
			
			$('<div type="button" data-toggle="tooltip" title="Export including children..." class="fa fa-file-export"></div>')
			.on('click', function(event) {
				event.stopPropagation();
				that.#exportCompletely();
			}) 
		]);	
	}
	
	/**
	 * Switch back to the standard editor.
	 */
	#back() {
		if (this.#current && Document.isTypeValid(this.#current.type)) {
			this._app.routing.call(this.#current._id);
		} else {
			this._app.browserBack();
		}
	}
	
	/**
	 * Export (download as JSON file) completely with all children.
	 */
	#exportCompletely() {
		if (!this.#current) return;
		
		var children = this._app.data.getChildren(this.#current._id, true);
		
		var ids = [this.#current._id];
		for(var d in children) {
			ids.push(children[d]._id);
		}
		
		if (!confirm('Download JSON export data of ' + this.#current.name + ' including its contents (' + ids.length + ' documents)?')) return;
		
		var that = this;
		(new NotesExporter(this._app)).export(ids)
		.then(function(/*data*/) {
			that._app.view.message('Exported ' + children.length + ' documents.', 'S', 'ExportDocsMessages');
		})
		.catch(function(err) {
			that._app.errorHandler.handle(err);
		});
	}
	
	/**
	 * Save current data
	 */
	#save() {
		if (!this.#editor) return;
		
		if (!confirm('Really save the raw document data? This could lead to inconsistencies.')) return;
		
		var doc = JSON.parse(this.#editor.getValue());
		
		var that = this;
		this._app.documentAccess.saveDbDocument(doc)
		.then(function(data) {
			return that._app.actions.nav.requestTree();
		})
		.then(function(data) {
			that._app.view.message('Saved ' + (doc.name ? doc.name : 'the document') + '.', 'S', 'SaveDbDocMessages');
			
			if (doc._id) {
				that._app.routing.call('raw/' + doc._id);
			}
		})
		.catch(function(err) {
			that._app.errorHandler.handle(err);
		});
	}
}