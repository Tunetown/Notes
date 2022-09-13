/**
 * Import manager class
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
class Import {
	
	/**
	 * The passed importer must have at least the following methods:
	 * 
	 * process(str, sourceName): Import the passed string data. str is the 
	 *                           string data to be imported, sourceName is 
	 *                           the name of the source file. 
	 */
	constructor(importer) {
		this.importer = importer;
	}
	
	/**
	 * Ask the user for a file and start the import
	 */
	startFileImport() {
		var n = Notes.getInstance();
		var that = this;
		
		$('#importOptionsContainer').empty();
		$('#importFile').val('');
		this.importer.initialize();
		
		$('#importDialogSubmitButton').off('click');
		$('#importDialogSubmitButton').on('click', function(event) {
			var file = $('#importFile')[0].files[0];
    		
    		if (!file) {
    			n.showAlert('Please select a file to import.', 'E', 'ImportProcessMessages');
				return;
		    }
    		
			$('#importDialog').modal('hide');
			
			Console.log('File Import: Loading ' + file.name, 'I');
			
			n.routing.callConsole();
			
			setTimeout(function() {
				that.processFile(file)
				.catch(function(err) {
					n.showAlert(err.message, err.abort ? 'I': "E", err.messageThreadId);
				});
			}, 100);
		});
		
		$('#importDialog').modal();
	}
	
	/**
	 * Import a given file.
	 */
	processFile(file) {
		var n = Notes.getInstance();
		var that = this;
		return new Promise(function(resolve, reject) {
			if (!file) {
				reject({
					message: 'No file selected',
					messageThreadId: 'ImportProcessMessages'					
				});
			}
			
			var reader = new FileReader();
			reader.onload = function() {
				resolve({
					ok: true,
					json: reader.result
				});
			}
			
			reader.readAsText(file);
		})
		.then(function(data) {
			Console.log('Received ' + Tools.convertFilesize(data.json.length) + ' of data from ' + file.name, 'I');
			
			return that.importer.process(data.json, file.name);
		})
		.then(function(data) {
			return Actions.getInstance().requestTree();
		})
		.catch(function(err) {
			n.showAlert((!err.abort ? 'Error importing data: ' : '') + err.message, err.abort ? 'I' : 'E', err.messageThreadId);
		})
	}
}