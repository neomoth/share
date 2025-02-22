// ==UserScript==
// @name        owop-teleport
// @namespace   Violentmonkey Scripts
// @match       https://ourworldofpixels.com/*
// @grant       none
// @version     1.0
// @author      Neomoth
// @description 5/9/2023, 12:07:00 AM
// @run-at      document-start
// ==/UserScript==

// credit goes to Lapis for most of this, tldr this is a heavily scooped out BetterOPM that JUST adds /tp because
// i am stupid and can't figure out how to do it myself lmaoooooo

const filesURLBase = localStorage.OPMFilesURL || "https://raw.githubusercontent.com/LapisHusky/betteropm/main/"
let opmPackages = [];
let packagesToInstall = [
	"teleport",
	"circle-tool",
	"core-utils",
	"cursor-nicks",
	"bucket-inspector",
	"owop-tool-class",
	"pixel-eraser",
	"player-list",
	"player-list-plus",
	"sajvnczeid-radio",
	"speed-o-meter",
	"show-place-id",
	"palette-ai"
];
let moduleList = [];
let originalFunction = Object.defineProperty;
Object.defineProperty = function () {
	let returnValue = originalFunction.call(originalFunction, ...arguments);
	let object = arguments[0];
	if(!object?.__esModule) return returnValue;

	let stack = new Error().stack;
	let line = stack.split("\n")[2];
	if (!line || !line.includes("app")) return returnValue;

	moduleList.push(object);
	if(moduleList.length===1){
		setTimeout(()=>{
			finishedLoading()
		}, 0);
	}
	return returnValue;
}

let worldJoinPromiseResolve;
let worldJoinPromise = new Promise(r=>{
	worldJoinPromiseResolve = r;
});

let opmModule = {
	get Opm() {
		console.warn(`something tried to get OWOP.require("opm".Opm, this is unsupported`);
		return () => { }
	}
}

let modules = {};

function finishedLoading(){
	modules.canvas_renderer = moduleList.find(module=>module.unloadFarClusters);
	modules.captcha = moduleList.find(module=>module.loadAndRequestCaptcha);
	modules.conf = moduleList.find(module => module.EVENTS)
	modules.context = moduleList.find(module => module.createContextMenu)
	modules.Fx = moduleList.find(module => module.PLAYERFX)
	modules.global = moduleList.find(module => module.PublicAPI)
	modules.local_player = moduleList.find(module => module.networkRankVerification)
	modules.main = moduleList.find(module => module.revealSecrets)
	modules.Player = moduleList.find(module => module.Player)
	modules.windowsys = moduleList.find(module => module.windowSys)
	modules.World = moduleList.find(module => module.World)
	modules.events = modules.global.eventSys.constructor
	modules.networking = moduleList.find(module => module.net)
	modules.tools = moduleList.find(module => module.showToolsWindow)
	modules.tool_renderer = moduleList.find(module => module.cursors)
	modules["protocol/Protocol"] = moduleList.find(module => module.Protocol)
	modules["protocol/all"] = moduleList.find(module => module.definedProtos)
	modules["protocol/old"] = moduleList.find(module => module.OldProtocol)
	modules["util/Bucket"] = moduleList.find(module => module.Bucket)
	modules["util/Lerp"] = moduleList.find(module => module.Lerp)
	modules["util/anchorme"] = moduleList.find(module => module.default?.validate).default
	modules["util/misc"] = moduleList.find(module => module.setCookie)
	modules["util/color"] = moduleList.find(module => module.colorUtils)
	modules["util/normalizeWheel"] = moduleList.find(module => module.normalizeWheel)
	modules.opm = opmModule
	modules.all = moduleList

	OWOP.net = modules.networking.net;
	modules.main.revealSecrets = () => { }

	OWOP.eventSys = modules.global.eventSys;
	OWOP.misc = modules.main.misc;
	OWOP.tool = OWOP.tools;

	OWOP.require = function getModule(name) {
		if(name.endsWith('.js')) name = name.substring(0, name.length -3);
		if(modules[name]) return modules[name];
		throw new Error(`No module with name ${name}`);
	}

	let allEvents = modules.conf.EVENTS;
	for(let key in allEvents){
		OWOP.events[key] = allEvents[key];
	}

	OWOP.once(OWOP.events.net.world.join, worldJoinPromiseResolve);
}

function unstrictEval(text) {
	return eval(text)
}

let user = {
	installed: []
}

if (localStorage.OPMInstalled) user.installed = JSON.parse(localStorage.OPMInstalled)
function saveInstalled() {
	localStorage.OPMInstalled = JSON.stringify(user.installed)
}

class PackageItem{
	constructor(data){
		this.installed = false;
		this.installPromise = null;
		this.dependencies = data.dependencies;
		this.name = data.name;
	}
	async install(){
		if(this.installed) return;
		if(this.installPromise) return this.installPromise;
		let resolve;
		this.installPromise = new Promise(r=>{
			resolve = r;
		});
		for(let dependency of this.dependencies){
			let dependencyItem = opmPackages.find(p=>p.name===dependency);
			let installPromises = [];
			if(!dependencyItem.installed){
				installPromises.push(dependencyItem.install());
			}
			await Promise.all(installPromises);
		}
		if (!this.module){
			let script = await fetch(filesURLBase + `packages/${this.name}/main.js`);
			script = await script.text();
			this.module = unstrictEval(script);
		}
		this.module.install();
		if(!user.installed.includes(this.name)){
			user.installed.push(this.name);
			saveInstalled();
		}
		this.installed = true;
		resolve();
		this.installPromise = null;
	}
}

async function start(){
	let res = await fetch(filesURLBase + "packages.json");
	let packages = await res.json();
	for (let package of packages){
		opmPackages.push(new PackageItem(package));
	}

	let renderer = OWOP.require("canvas_renderer");
	OWOP.camera.__defineSetter__("x", value=>{
		renderer.moveCameraTo(value, OWOP.camera.y);
	});
	OWOP.camera.__defineSetter__("y", value=>{
		renderer.moveCameraTo(OWOP.camera.x, value);
	});

	window.OPM = {
		packages: opmPackages,
		PackageItem,
		user,
		require: name => {
			return opmPackages.find(pack=>pack.name===name).module;
		}
	}

	opmModule.PackageItem = PackageItem;

	await worldJoinPromise;
	for(let packageName of user.installed){
		let pItem = opmPackages.find(pack=>pack.name===packageName);
		if(pItem) pItem.install();
	}
	if(user.installed.length<1){
		for(let packageName of packagesToInstall){
			let pItem = opmPackages.find(pack=>pack.name===packageName);
			if(pItem) pItem.install();
		}
	}
}

addEventListener("load", () => {
	start()
});
