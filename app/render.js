const Electron 		= require('electron'),
	  remote 		= Electron.remote,
	  dialog 		= remote.dialog,
	  ipcRenderer 	= Electron.ipcRenderer,
	  shell 		= Electron.shell;
	  Path 			= require('path'),
	  WebTorrent 	= require('webtorrent'),
	  Humanize 		= require('humanize-plus')

var client		= new WebTorrent(),
	settings	= remote.getGlobal('settings'),  
	locale		= require('./json/locale/' + settings.locale + '.json'),
	humanTime	= require('humanize-duration').humanizer({ language: settings.locale, largest: 1, round: true }),
	table		= $('#table').DataTable(tableConfig()),
	footer		= $(".main-footer").html(generalFoot())


////////////////////
////-- EVENTS --////
////////////////////
var call = {
		btn_add_modal 		 :()=> gui.addTorrentModal(),
		btn_add_download 	 :()=> addTorrent($('#tb-add-file').val()),
		btn_remove	 		 :()=> removeTorrent(table.row('tr.selected')),
		btn_pause			 :()=> pauseTorrent(table.row('tr.selected')),	
		btn_position_up 	 :()=> torrents[torrentSelected.infoHash].up(),
		btn_position_down 	 :()=> torrents[torrentSelected.infoHash].down(),
		btn_nav_main 		 :()=> gui.changePage('main'),
		btn_nav_stats 		 :()=> gui.changePage('stats'),
		btn_nav_autofeeds 	 :()=> gui.changePage('autofeeds'),
		btn_nav_channels 	 :()=> gui.changePage('channels'),
		btn_add_fileDialog	 :()=> gui.getDialogFile(), 
		btn_add_folderDialog :()=> gui.getDialogFolder(),
		btn_search	 		 :()=> gui.searchTorrent(),
		btn_bottom_settings	 :()=> gui.changePage('settings'),
		btn_bottom_fullscreen:()=> ipcRenderer.send('control', 'fullscreen'),
		btn_bottom_private	 :()=> alert('private'),
		btn_bottom_hide		 :()=> ipcRenderer.send('control', 'hide'),
		btn_bottom_close	 :()=> ipcRenderer.send('control', 'close'),
		btn_sidebar_toggle	 :()=> $('.sidebar-footer').toggle()
	}

$('#table tbody').on( 'click', 'tr', function () {
	if($('#table tbody td').hasClass('dataTables_empty')) return false 

	if ($(this).hasClass('selected')) { 
		$(this).removeClass('selected')
		$('#btns-hided').hide()
		torrentSelected = null
	} else {
		table.$('tr.selected').removeClass('selected')
		$(this).addClass('selected')
		torrentSelected = client.get($(this).data("hash")) 
		$('#btns-hided').show()
	}
})

///////////////////////
////-- FUNCTIONS --////
///////////////////////
var	torrents = {
	find: position => {
		for (var i in torrents) 
			if(torrents[i].position === position)
				return torrents[i]
	},
	
	length: () => {
		let length = -2
		for (var i in torrents)	length++
		return length
	}
}


function tableConfig(){
	let json = require('./json/datatable.json')

	for (var i = json.columns.length - 1; i >= 0; i--) {
		json.columns[i].title = locale.table[json.columns[i].title]
	}
	return json

}

var gui = {
	addTorrentModal: () => {		
		$('#addModal').modal('toggle')
		$('#tb-add-folder').val(settings.dir_downloads)
	},

	changePage: type => {
		$('.content-wrapper').hide()
		$('.content-wrapper-' + type).show()
		$('.sidebar-menu li').removeClass('active')
		$('#btn_nav_' + type).addClass('active')	
	},

	searchTorrent: () => {
		shell.openExternal(settings.searchers[settings.search_with] + $('#tb-search').val())
	},

	getDialogFile: () => {
		let config = {	title: 'Please select a torrent',
						filters: [{ name: 'Torrents', extensions: ['torrent'] }],
						defaultPath: settings.dir_downloads,
						properties: ['openFile']
					 }

		dialog.showOpenDialog(config, name => $('#tb-add-file').val(name))	
	},

	getDialogFolder: () => {
		let config = {  title: 'Please select a folder',
						defaultPath: settings.dir_downloads,
						properties: ['openDirectory', 'createDirectory']
					 }		

		dialog.showOpenDialog(config, name => $('#tb-add-folder').val(name))	
	},

	setTray: (blink, color) => {
		settings.tray_blink = blink
		settings.tray_color = color
	}

}


function addTorrent(torrentID){
	let temp = table.row.add([
		' ',
		locale.loading,
		'0 Kb/s',
		progressBar(0, $('#table')),
		'0 Kb/s',
		'0 Kb/s',
		'0',
		'0',
		'-'
	]).draw()
	
	let torrent = client.add(torrentID,	{ path: $('#tb-add-folder').val() }, torrent => {  })

	torrent.on('infoHash', error => {
		$(temp.node()).attr('data-hash', torrent.infoHash)
		if(!torrents[torrent.infoHash]) torrents[torrent.infoHash] = new Torrent()
	})

	torrent.on('error', error => {
		temp.row().remove().draw()
		gui.setTray(false, 'red')
		alert(error)
		//TODO: cambiar el alert por:
		//dialog.showErrorBox(title, content)
	})

	torrent.on('done', () => gui.setTray(true, 'green'))

}

function removeTorrent(row){
	// TODO: Preguntar si esta seguro, y si quiere borrar los archivos tambien
	torrentSelected.destroy( () => {
		row.remove().draw()
		$('#btns-hided').hide()
		//if(client.torrents.length === 0) 
	})

}

function pauseTorrent(row){
	$('#btn-pause i').toggleClass('fa-pause').toggleClass('fa-play')

	// NOTE: Pausa pero no funciona
	console.log(torrentSelected.paused)
	if(torrentSelected.paused) torrentSelected.resume()
	else torrentSelected.pause()
	console.log(torrentSelected.paused)
}

function fixRatio(ratio){
	if(ratio > 1000) return "&infin;"
	return Humanize.formatNumber(ratio, 2)
}

function progressBar(progress, element, torrent = null){ 

	let size = element.find('.progress').outerWidth()
	let style = ''	

	if(torrent){
		style = 'progress-bar-info progress-bar-striped'
		if(torrent.done) style = 'progress-bar-success' 
		else if(torrent.paused) style = 'progress-bar-warning' 
		else if(torrent.ready) style = ''
	}

// FIX: Cambiar para que no regenere toda la barra todo el tiempo
	return `<div class="progress">
				<span class="p-black" style="width: ${size}px;">${progress}%</span>
				<div class="progress-bar ${style}" role="progressbar" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100" style="width: ${progress}%;">
					<span class="p-white" style="width: ${size}px;">${progress}%</span>
				</div>
			</div>
			`
}

function generalFoot (){	
	let pb = progressBar((client.progress * 100).toFixed(1), $('.main-footer'))
	let ds = Humanize.fileSize(client.downloadSpeed) + '/s'
	let us = Humanize.fileSize(client.uploadSpeed) + '/s'
	let ra = fixRatio(client.ratio)
	let o = ""
	if(ra <= 1) o = "-o"

	return `<div class="row">
				<div class="col-md-10">
					<span class="ft-cell"><i class="fa fa-fw fa-arrow-down"></i> ${ds} </span>
					<span class="ft-cell"><i class="fa fa-fw fa-arrow-up"></i> ${us} </span>
					<span class="ft-cell"><i class="fa fa-fw fa-heart${o}"></i> ${ra} </span>
				</div>
				<div class="col-md-2">${pb}</div>
			</div>
			` 	
}


///////////////////////
////-- INTERVALS --////
///////////////////////
var interval = {
	table: null,
	tray: null,
	updateTable: () => {
		let count = client.torrents.length
		
		if(count <= 0) return null

		for (var i = count - 1; i >= 0; i--) {
			torrent = client.torrents[i]
			table.row(i).data([
				torrents[torrent.infoHash].position,
				torrent.name,
				Humanize.fileSize(torrent.downloaded),
				progressBar((torrent.progress * 100).toFixed(1), $('#table'), torrent),
				Humanize.fileSize(torrent.downloadSpeed) + "/s",
				Humanize.fileSize(torrent.uploadSpeed) + "/s",
				torrent.numPeers,
				fixRatio(torrent.ratio),
				humanTime(torrent.timeRemaining)
			]).draw()
		}

		$(".main-footer").html(generalFoot())
	},

	updateTray: () => {
		let ds = Humanize.fileSize(client.downloadSpeed) + '/s'
		let us = Humanize.fileSize(client.uploadSpeed) + '/s'

		ipcRenderer.send('tray', ' ↓ ' + ds + ' ↑ ' + us, settings.tray_blink, settings.tray_color)
	},

	startAll: () => {	
		interval.table = setInterval(() => interval.updateTable(), settings.interval_refresh)
		interval.tray = setInterval(() => interval.updateTray(), settings.interval_tray)
	}

}

interval.startAll()
/*
var interval = setInterval( () => {
	let count = client.torrents.length
	
	if(count <= 0) return null

	for (var i = count - 1; i >= 0; i--) {
		torrent = client.torrents[i]
		table.row(i).data([
			torrents[torrent.infoHash].position,
			torrent.name,
			Humanize.fileSize(torrent.downloaded),
			progressBar((torrent.progress * 100).toFixed(1), $('#table'), torrent),
			Humanize.fileSize(torrent.downloadSpeed) + "/s",
			Humanize.fileSize(torrent.uploadSpeed) + "/s",
			torrent.numPeers,
			fixRatio(torrent.ratio),
			humanTime(torrent.timeRemaining)
		]).draw()
	}

	$(".main-footer").html(generalFoot())	

}, settings.interval_refresh)

var intervalTray = setInterval( () => {
	let ds = Humanize.fileSize(client.downloadSpeed) + '/s'
	let us = Humanize.fileSize(client.uploadSpeed) + '/s'

	ipcRenderer.send('tray', ' ↓ ' + ds + ' ↑ ' + us, settings.tray_blink, settings.tray_color)

}, settings.interval_tray)
*/

/////////////////////
////-- CLASSES --////
/////////////////////
class Torrent { 
	constructor() {	
		this._position = torrents.length()
		this.progress = 50
	}
	
	get position() { return this._position }
	set position(value) { this._position = value }

	up() { 
		let nextTorrent = torrents.find(this._position+1)
		if(nextTorrent){
			this._position++
			nextTorrent._position--
		} else return null
	}
	down() {
		let prevTorrent = torrents.find(this._position-1)
		if(prevTorrent){
			this._position--
			prevTorrent._position++
		} else return null
	}

}




///////////////////
////** DEBUG **////
///////////////////
var tId0 = 'magnet:?xt=urn:btih:6a9759bffd5c0af65319979fb7832189f4f3c35d&dn=sintel.mp4&tr=wss%3A%2F%2Ftracker.btorrent.xyz&tr=wss%3A%2F%2Ftracker.fastcast.nz&tr=wss%3A%2F%2Ftracker.openwebtorrent.com&tr=wss%3A%2F%2Ftracker.webtorrent.io&ws=https%3A%2F%2Fwebtorrent.io%2Ftorrents%2Fsintel-1024-surround.mp4'
var tId2 = "/home/facuz/Descargas/sintel.torrent"

$('#tb-add-file').val(tId0)

//addTorrent(tId0)
//addTorrent(tId1)
////** END DEBUG **////