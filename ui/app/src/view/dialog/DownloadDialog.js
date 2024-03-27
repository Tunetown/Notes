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
class DownloadDialog {  
	
	#app = null;
	
	#downloadFormatSelect = null;
	#downloadDepthSelect = null;
	#downloadStyleSelect = null;
	#downloadContentsSelect = null;
	#downloadTimestampsSelect = null;

	constructor(app) {
		this.#app = app;
	}
	
	/**
	 * Download document dialog with options
	 * 
	 * Returns:
	 * {
	 *     format, 
	 *     depth,  
	 *     listStyle,
	 *     contentSel, 
	 *     timestamps,
	 * }
	 */
	async show(question) { 
		var content = this.#createContent();		
		
		this.#setType(this.#downloadFormatSelect.val());

		var answer = await this.#app.view.getDialog().confirm(
			question, 
			content 
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
		return { 
			ok: true,
			
			format: this.#downloadFormatSelect.val(),
			depth: this.#downloadDepthSelect.val(),
			listStyle: this.#downloadStyleSelect.val(),
			contentSel: this.#downloadContentsSelect.val(),
			timestamps: this.#downloadTimestampsSelect.val()
		};
	}
	
	/**
	 * Resets the instance for further usage
	 */
	#reset() {
		this.#downloadFormatSelect = null;
		this.#downloadDepthSelect = null;
		this.#downloadStyleSelect = null;
		this.#downloadContentsSelect = null;
		this.#downloadTimestampsSelect = null;
	}
	
	/**
	 * Create the image type selector and preview etc.
	 */
	#createContent() {
		var that = this;
		
		this.#downloadFormatSelect = $('<select />').append(
			$('<option value="txt" selected />').text('Plain Text'),
			$('<option value="html" />').text('HTML')
		);
		
		this.#downloadDepthSelect = $('<select />').append(
			$('<option value="0" selected />').text('Current Doc. only'),
			$('<option value="1" />').text('Include direct children'),
			$('<option value="2" />').text('Include direct children and their children'),
			$('<option value="all" />').text('Include all contained Documents')
		);
		
		this.#downloadStyleSelect = $('<select />').append(
			$('<option value="none" selected />').text('None'),
			$('<option value="numbers" />').text('Numbers'),
			$('<option value="dashes" />').text('Dashes (-)')
		);
		
		this.#downloadContentsSelect = $('<select />').append(
			$('<option value="all" selected />').text('Contents of all Documents'),
			$('<option value="main" />').text('Content of Main Document only'),
			$('<option value="none" />').text('No Contents (just Names)')
		);
		
		this.#downloadTimestampsSelect = $('<select />').append(
			$('<option value="all" />').text('Timestamps of all Documents'),
			$('<option value="main" />').text('Timestamp of Main Document only'),
			$('<option value="none" selected />').text('No Timestamps'),
			$('<option value="current" />').text('Current time only (for main doc.)')
		);
          				
		return [
			$('<table />').append(
	      		$('<tr />').append(
	      			$('<td />')
	      			.text('Download format'),
	      			
	      			$('<td />').append(
	      				this.#downloadFormatSelect
	      			)
	      		),
	      		$('<tr />').append(
	      			$('<td />')
	      			.text('Depth'),
	      			
	      			$('<td />').append(
	      				this.#downloadDepthSelect 
		            )
	      		),
	      		$('<tr />').append(
	      			$('<td />')
	      			.text('List Style'),
	      			
	      			$('<td />').append(
	      				this.#downloadStyleSelect
		            )
	      		),
	      		$('<tr />').append(
	      			$('<td />')
	      			.text('Contents'),
	      			
	      			$('<td />').append(
	      				this.#downloadContentsSelect
		            )
	      		),
	      		$('<tr />').append(
	      			$('<td />')
	      			.text('Include Timestamps'),
	      			
	      			$('<td />').append(
	      				this.#downloadTimestampsSelect
		            )
	      		)
	      	),
	      	
	      	$('<br>'),
	      	
	      	$('<button type="button" class="btn btn-secondary" />')
	      	.text('Set for HTML Download')   
	      	.on('click', function(e) {
				e.stopPropagation();
				
				that.#downloadFormatSelect.val('html');
				that.#downloadDepthSelect.val('0');
				that.#downloadStyleSelect.val('none');
				that.#downloadContentsSelect.val('main');
				that.#downloadTimestampsSelect.val('main');
			}),
	      	
	      	$('<button type="button" class="btn btn-secondary" />')
	      	.text('Set for TOC Download')   
	      	.on('click', function(e) {
				e.stopPropagation();
				
				that.#downloadFormatSelect.val('txt');
				that.#downloadDepthSelect.val('1');
				that.#downloadStyleSelect.val('numbers');
				that.#downloadContentsSelect.val('none');
				that.#downloadTimestampsSelect.val('current');
			})
		];
	}
	
	/**
	 * Update inputs according to the currently selected type
	 */
	#setType(type) {
		
	}
}
	