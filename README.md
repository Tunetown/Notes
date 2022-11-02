# Notes

## What is Notes?
This is a Notes Taking App based purely on CouchDB and JavaScript, licensed under the GPL v3. See <a href="https://notes.webertom.net" target="_blank">notes.webertom.net</a> to see it in action and check out more details.

## Version History
- 0.76.0
    - Initially published beta version

- 0.77.0 
    - Detail List Navigation: Double click now returns to root (previously this reloaded the area and was used for debugging)
    - New update strategy
    - New message display

- 0.80.0
    - Message threads
    - Small bug fixes

- 0.81.0
    - Re-install button added to trigger reloading anytime from the Update page

- 0.82.0
    - Redirect to last loaded on landing page (switchable in Settings)
    - Links in Messages
    - Added home buttons for detail list navigation
    - Check for updates on About page
    - Renaming of "Profile" -> "Notebook"
    - Rework of Documentation

- 0.83.0
	- Documentation updates
	- PWA App Frame color now follows the notebook color

- 0.84.0
    - Removed some console messages which are not necessary
    - Fixed message order
    - Warning if the noteboo is accessed online only (this may be slow, users should only use this for temporary access)
 
- 0.86.0
    - Bug fixes, documentation updates
    - Auto login when browser did auto complete
    - Landing page: Show notebook details and sync/clone status
    
- 0.87.0
    - Added Favorites Bar

- 0.88.0
    - Added item background images

- 0.89.0
    - Bug fixes and small minor improvements
    - Optimized background images (now always rescaled to be really small, and stubbed in TOC)
    - References: Now opened via routing
    - Console URL now independent of notebook

- 0.90.0
    - Board backgrounds now way more flexible, like item backgrounds
    - Selected item in detail view is highlighted better
    - Rework of attachment names for attachment documents (backwards compatible)
    - Optical improvements

- 0.91.0
    - Dragging Optimization for Boards in mobile mode
    - Bug fixes
    - Refactoring

- 0.92.0
    - Added Obsidian Exporter
    - Small bug fixes

- 0.93.0 
    - Internal links in documents: Rich text and Plain text (Code)
    - Renamed code editor to Plain Text
    - Setting for item height in navigation
    - Default editor is now Plain Text
    - Raw JSON export: Better file name
    - Added temporary warning to remove sheet documents in near future

- 0.93.6
    - Bug fix: Sort modes were not stored properly before
    - Login Screen: Auto-Submit not active when in settings page
    - Link auto completion
    - Visual Graph page
    - Linkage buttons now available to customize the relation between editor and navigation
    - Custom search help proposals
    - Option to convert references to links (see re-target option)
    - Small improvements in the Settings dialog
    - Select all option
    - Runtime optimizations (added Document generator for testing)
    - Version restore now more convenient
    - Performance optimizations (up to 6000 documents easily possible)
    
    
    