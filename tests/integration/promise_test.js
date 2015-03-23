/*globals findByLabel, clickByLabel */
import Ember from "ember";
import { test } from 'ember-qunit';
import { module } from 'qunit';
import startApp from '../helpers/start-app';
var App;

var port, message, name;

module('Promise Tab', {
  beforeEach() {
    App = startApp({
      adapter: 'basic'
    });
    port = App.__container__.lookup('port:main');
    port.reopen({
      send: function(n, m) {
        if (n === 'promise:getAndObservePromises') {
          port.trigger('promise:promisesUpdated', {
            promises: []
          });
        }
       if (n === 'promise:supported') {
          this.trigger('promise:supported', {
            supported: true
          });
        }
        name = n;
        message = m;
      }
    });
  },
  afterEach() {
    name = null;
    message = null;
    Ember.run(App, App.destroy);
  }
});

var guids = 0;
function generatePromise(props) {
  return $.extend({
    guid: ++guids,
    label: 'Generated Promise',
    parent: null,
    children: null,
    state: 'created',
    value: null,
    reason: null,
    createdAt: Date.now(),
    hasStack: false
  }, props);
}

test("Backwards compatibility - no promise support", function(assert) {
  port.reopen({
    send: function(n, m) {
      if (n === 'promise:supported') {
        this.trigger('promise:supported', {
          supported: false
        });
      }
    }
  });

  visit('/promises').
  then(function() {
    assert.equal(findByLabel('error-page').length, 1, 'The error page should show up');
    assert.equal(findByLabel('error-page-title').text().trim(), 'Promises not detected!');
  });
});

test("Shows page refresh hint if no promises", function(assert) {
  visit('/promises');

  andThen(function() {
    port.trigger('promise:promisesUpdated', {
      promises: []
    });
    return wait();
  });

  andThen(function() {
    assert.equal(findByLabel('promise-tree').length, 0, "no promise list");
    assert.equal(findByLabel('page-refresh').length, 1, "page refresh hint seen");
  });

  clickByLabel('page-refresh-btn');

  andThen(function() {
    assert.equal(name, 'general:refresh');
  });

  andThen(function() {
    port.trigger('promise:promisesUpdated', {
      promises: [
        generatePromise({
          guid: 1,
          label: 'Promise 1',
          state: 'created'
        })
      ]
    });
    wait();
  });

  andThen(function() {
    assert.equal(findByLabel('promise-tree').length, 1, 'promise tree is seen after being populated');
    assert.equal(findByLabel('promise-item').length, 1, '1 promise item can be seen');
    assert.equal(findByLabel('page-refresh').length, 0, 'page refresh hint hidden');
  });

  // make sure clearing does not show the refresh hint
  clickByLabel('clear-promises-btn');

  andThen(function() {
    assert.equal(findByLabel('promise-tree').length, 1, 'promise-tree can be seen');
    assert.equal(findByLabel('promise-item').length, 0, 'promise items cleared');
    assert.equal(findByLabel('page-refresh').length, 0, 'page refresh hint hidden');
  });


});

test("Pending promise", function(assert) {

  visit('/promises');

  andThen(function() {
    port.trigger('promise:promisesUpdated', {
      promises: [
        generatePromise({
          guid: 1,
          label: 'Promise 1',
          state: 'created'
        })
      ]
    });
    wait();
  });

  andThen(function() {
    assert.equal(findByLabel('promise-item').length, 1);
    var row = findByLabel('promise-item').first();
    assert.equal(findByLabel('promise-label', row).text().trim(), 'Promise 1');
    assert.equal(findByLabel('promise-state', row).text().trim(), 'Pending');
  });

});


test("Fulfilled promise", function(assert) {
  visit('/promises');

  var now = Date.now();

  andThen(function() {
    port.trigger('promise:promisesUpdated', {
      promises: [
        generatePromise({
          guid: 1,
          label: 'Promise 1',
          state: 'fulfilled',
          value: {
            inspect: 'value',
            type: 'type-string'
          },
          createdAt: now,
          settledAt: now + 10
        })
      ]
    });
    wait();
  });

  andThen(function() {
    assert.equal(findByLabel('promise-item').length, 1);
    var row = findByLabel('promise-item').first();
    assert.equal(findByLabel('promise-label', row).text().trim(), 'Promise 1');
    assert.equal(findByLabel('promise-state', row).text().trim(), 'Fulfilled');
    assert.equal(findByLabel('promise-value', row).text().trim(), 'value');
    assert.equal(findByLabel('promise-time', row).text().trim(), '10.00ms');
  });
});


test("Rejected promise", function(assert) {
  visit('/promises');

  var now = Date.now();

  andThen(function() {
    port.trigger('promise:promisesUpdated', {
      promises: [
        generatePromise({
          guid: 1,
          label: 'Promise 1',
          state: 'rejected',
          reason: {
            inspect: 'reason',
            type: 'type-string'
          },
          createdAt: now,
          settledAt: now + 20
        })
      ]
    });
    wait();
  });

  andThen(function() {
    assert.equal(findByLabel('promise-item').length, 1);
    var row = findByLabel('promise-item').first();
    assert.equal(findByLabel('promise-label', row).text().trim(), 'Promise 1');
    assert.equal(findByLabel('promise-state', row).text().trim(), 'Rejected');
    assert.equal(findByLabel('promise-value', row).text().trim(), 'reason');
    assert.equal(findByLabel('promise-time', row).text().trim(), '20.00ms');
  });

});

test("Chained promises", function(assert) {
  visit('/promises');

  andThen(function() {
    port.trigger('promise:promisesUpdated', {
      promises: [
        generatePromise({
          guid: 2,
          parent: 1,
          label: 'Child'
        }),
        generatePromise({
          guid: 1,
          children: [2],
          label: 'Parent'
        })
      ]
    });
    wait();
  });

  andThen(function() {
    var rows = findByLabel('promise-item');
    assert.equal(rows.length, 1, 'Collpased by default');
    assert.equal(findByLabel('promise-label', rows.eq(0)).text().trim(), 'Parent');
    return clickByLabel('promise-label', rows.eq(0));
  });

  andThen(function() {
    var rows = findByLabel('promise-item');
    assert.equal(rows.length, 2, 'Chain now expanded');
    assert.equal(findByLabel('promise-label', rows.eq(1)).text().trim(), 'Child');
  });
});

test("Can trace promise when there is a stack", function(assert) {
  visit('/promises');

  andThen(function() {
    port.trigger('promise:promisesUpdated', {
      promises: [generatePromise({ guid: 1, hasStack: true })]
    });
    wait();
  });

  clickByLabel('trace-promise-btn');

  andThen(function() {
    assert.equal(name, 'promise:tracePromise');
    assert.deepEqual(message, { promiseId: 1 });
  });

});


test("Trace button hidden if promise has no stack", function(assert) {
  visit('/promises');

  andThen(function() {
    port.trigger('promise:promisesUpdated', {
      promises: [generatePromise({ guid: 1, hasStack: false })]
    });
    wait();
  });

  andThen(function() {
    assert.equal(findByLabel('trace-promise-btn').length, 0);
  });

});

test("Toggling promise trace option", function(assert) {
  assert.expect(3);

  visit('/promises');

  andThen(function() {
    var input = findByLabel('with-stack').find('input');
    assert.ok(!input.prop('checked'), 'should not be checked by default');
    return click(input);
  });

  andThen(function() {
    assert.equal(name, 'promise:setInstrumentWithStack');
    assert.equal(message.instrumentWithStack, true);
  });

});

test("Logging error stack trace in the console", function(assert) {
  visit('/promises');

  andThen(function() {
    port.trigger('promise:promisesUpdated', {
      promises: [generatePromise({
        guid: 1,
        state: 'rejected',
        reason: {
          inspect: 'some error',
          type: 'type-error'
        }
      })]
    });
    wait();
  });

  andThen(function() {
    var row = findByLabel('promise-item').first();
    assert.equal(findByLabel('send-to-console-btn').text().trim(), 'Stack trace');
    return clickByLabel('send-to-console-btn', row);
  });

  andThen(function() {
    assert.equal(name, 'promise:sendValueToConsole');
    assert.deepEqual(message, { promiseId: 1 });
  });
});


test("Send fulfillment value to console", function(assert) {
  visit('/promises');

  andThen(function() {
    port.trigger('promise:promisesUpdated', {
      promises: [generatePromise({
        guid: 1,
        state: 'fulfilled',
        value: {
          inspect: 'some string',
          type: 'type-string'
        }
      })]
    });
    wait();
  });

  andThen(function() {
    var row = findByLabel('promise-item').first();
    clickByLabel('send-to-console-btn', row);
  });

  andThen(function() {
    assert.equal(name, 'promise:sendValueToConsole');
    assert.deepEqual(message, { promiseId: 1 });
  });
});

test("Sending objects to the object inspector", function(assert) {
  visit('/promises');

  andThen(function() {
    port.trigger('promise:promisesUpdated', {
      promises: [generatePromise({
        guid: 1,
        state: 'fulfilled',
        value: {
          inspect: 'Some Object',
          type: 'type-ember-object',
          objectId: 100
        }
      })]
    });
    wait();
  });

  andThen(function() {
    var row = findByLabel('promise-item').first();
    return clickByLabel('promise-object-value', row);
  });

  andThen(function() {
    assert.equal(name, 'objectInspector:inspectById');
    assert.deepEqual(message, { objectId: 100 });
  });
});
