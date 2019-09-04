import EventList from './EventList';
import BaseEvent from './BaseEvent';

/**
 * 事件执行器
 * @author tengge / https://github.com/tengge1
 */
function EventDispatcher(app) {
    this.dispatch = d3.dispatch.apply(d3.dispatch, EventList);
    this.addDomEventListener();

    this.events = [

    ];
}

EventDispatcher.prototype = Object.create(BaseEvent.prototype);
EventDispatcher.prototype.constructor = EventDispatcher;

/**
 * 启动
 */
EventDispatcher.prototype.start = function () {
    this.events.forEach(n => {
        n.start();
    });
};

/**
 * 停止
 */
EventDispatcher.prototype.stop = function () {
    this.events.forEach(n => {
        n.stop();
    });
};

/**
 * 执行事件
 * @param {*} eventName 
 * @param {*} _this 
 * @param {*} others 
 */
EventDispatcher.prototype.call = function (eventName, _this, ...others) {
    this.dispatch.call(eventName, _this, ...others);
};

/**
 * 监听事件
 * @param {*} eventName 
 * @param {*} callback 
 */
EventDispatcher.prototype.on = function (eventName, callback) {
    this.dispatch.on(eventName, callback);
};

/**
 * 监听dom事件
 */
EventDispatcher.prototype.addDomEventListener = function () {
    var container = app.container;
    container.addEventListener('click', event => {
        this.dispatch.call('click', this, event);
    });
    container.addEventListener('contextmenu', event => {
        this.dispatch.call('contextmenu', this, event);
        event.preventDefault();
        return false;
    });
    container.addEventListener('dblclick', event => {
        this.dispatch.call('dblclick', this, event);
    });
    document.addEventListener('keydown', event => {
        this.dispatch.call('keydown', this, event);
    });
    document.addEventListener('keyup', event => {
        this.dispatch.call('keyup', this, event);
    });
    container.addEventListener('mousedown', event => {
        this.dispatch.call('mousedown', this, event);
    });
    container.addEventListener('mousemove', event => {
        this.dispatch.call('mousemove', this, event);
    });
    container.addEventListener('mouseup', event => {
        this.dispatch.call('mouseup', this, event);
    });
    container.addEventListener('mousewheel', event => {
        this.dispatch.call('mousewheel', this, event);
    });
    window.addEventListener('resize', event => {
        this.dispatch.call('resize', this, event);
    }, false);
    document.addEventListener('dragover', event => {
        this.dispatch.call('dragover', this, event);
    }, false);
    document.addEventListener('drop', event => {
        this.dispatch.call('drop', this, event);
    }, false);
};

export default EventDispatcher;