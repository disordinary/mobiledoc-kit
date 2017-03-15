import { Editor } from 'mobiledoc-kit';
import Helpers from '../test-helpers';
import { TAB, ENTER } from 'mobiledoc-kit/utils/characters';

const { test, module } = Helpers;

const cards = [{
  name: 'my-card',
  type: 'dom',
  render() {},
  edit() {}
}];

const atoms = [{
  name: 'my-atom',
  type: 'dom',
  render() {}
}];

let editor, editorElement;

module('Acceptance: editor: basic', {
  beforeEach() {
    editorElement = $('#editor')[0];
  },
  afterEach() {
    if (editor) { editor.destroy(); }
  }
});

test('sets element as contenteditable', (assert) => {
  editor = new Editor();
  editor.render(editorElement);

  assert.equal(editorElement.getAttribute('contenteditable'),
               'true',
               'element is contenteditable');
});

test('#disableEditing before render is meaningful', (assert) => {
  editor = new Editor();
  editor.disableEditing();
  editor.render(editorElement);

  assert.ok(!editorElement.hasAttribute('contenteditable'),
            'element is not contenteditable');
  editor.enableEditing();
  assert.equal(editorElement.getAttribute('contenteditable'),
               'true',
               'element is contenteditable');
});

test('when editing is disabled, the placeholder is not shown', (assert) => {
  editor = new Editor({placeholder: 'the placeholder'});
  editor.disableEditing();
  editor.render(editorElement);

  assert.ok(!$('#editor').data('placeholder'), 'no placeholder when disabled');
  editor.enableEditing();
  assert.equal($('#editor').data('placeholder'), 'the placeholder',
               'placeholder is shown when editable');
});

test('#disableEditing and #enableEditing toggle contenteditable', (assert) => {
  editor = new Editor();
  editor.render(editorElement);

  assert.equal(editorElement.getAttribute('contenteditable'),
               'true',
               'element is contenteditable');
  editor.disableEditing();
  assert.equal(editorElement.getAttribute('contenteditable'),
               'false',
               'element is not contenteditable');
  editor.enableEditing();
  assert.equal(editorElement.getAttribute('contenteditable'),
               'true',
               'element is contenteditable');
});

test('clicking outside the editor does not raise an error', (assert) => {
  const done = assert.async();
  editor = new Editor({autofocus: false});
  editor.render(editorElement);

  let secondEditorElement = document.createElement('div');
  document.body.appendChild(secondEditorElement);

  let secondEditor = new Editor(); // This editor will be focused
  secondEditor.render(secondEditorElement);

  Helpers.dom.triggerEvent(editorElement, 'click');

  Helpers.wait(() => {
    assert.ok(true, 'can click external item without error');
    secondEditor.destroy();
    document.body.removeChild(secondEditorElement);

    done();
  });
});

test('typing in empty post correctly adds a section to it', (assert) => {
  const mobiledoc = Helpers.mobiledoc.build(({post}) => post());
  editor = new Editor({mobiledoc});
  editor.render(editorElement);

  assert.hasElement('#editor');
  assert.hasNoElement('#editor p');

  Helpers.dom.moveCursorTo(editor, editorElement);
  Helpers.dom.insertText(editor, 'X');
  assert.hasElement('#editor p:contains(X)');
  Helpers.dom.insertText(editor, 'Y');
  assert.hasElement('#editor p:contains(XY)', 'inserts text at correct spot');
});

test('typing when on the end of a card is blocked', (assert) => {
  editor = Helpers.editor.buildFromText('[my-card]', {element: editorElement, cards});

  let endingZWNJ = $('#editor')[0].firstChild.lastChild;
  Helpers.dom.moveCursorTo(editor, endingZWNJ, 0);
  Helpers.dom.insertText(editor, 'X');
  assert.hasNoElement('#editor div:contains(X)');
  Helpers.dom.moveCursorTo(editor, endingZWNJ, 1);
  Helpers.dom.insertText(editor, 'Y');
  assert.hasNoElement('#editor div:contains(Y)');
});

test('typing when on the start of a card is blocked', (assert) => {
  editor = Helpers.editor.buildFromText('[my-card]', {element: editorElement, cards});

  let startingZWNJ = $('#editor')[0].firstChild.firstChild;
  Helpers.dom.moveCursorTo(editor, startingZWNJ, 0);
  Helpers.dom.insertText(editor, 'X');
  assert.hasNoElement('#editor div:contains(X)');
  Helpers.dom.moveCursorTo(editor, startingZWNJ, 1);
  Helpers.dom.insertText(editor, 'Y');
  assert.hasNoElement('#editor div:contains(Y)');
});

test('typing tab enters a tab character', (assert) => {
  editor = Helpers.editor.buildFromText('|', {element: editorElement});

  Helpers.dom.insertText(editor, TAB);
  Helpers.dom.insertText(editor, 'Y');

  let {post: expected} = Helpers.postAbstract.buildFromText(`${TAB}Y`);
  assert.postIsSimilar(editor.post, expected);
});

// see https://github.com/bustlelabs/mobiledoc-kit/issues/215
test('select-all and type text works ok', (assert) => {
  editor = Helpers.editor.buildFromText('<abc>', {element: editorElement});

  assert.selectedText('abc', 'precond - abc is selected');
  assert.hasElement('#editor p:contains(abc)', 'precond - renders p');

  Helpers.dom.insertText(editor, 'X');

  assert.hasNoElement('#editor p:contains(abc)', 'replaces existing text');
  assert.hasElement('#editor p:contains(X)', 'inserts text');
});

test('typing enter splits lines, sets cursor', (assert) => {
  editor = Helpers.editor.buildFromText('hi|hey', {element: editorElement});

  assert.hasElement('#editor p:contains(hihey)');

  Helpers.dom.insertText(editor, ENTER);
  let {post: expected, range: expectedRange} = Helpers.postAbstract.buildFromText(['hi','|hey']);
  assert.postIsSimilar(editor.post, expected, 'correctly encoded');
  assert.rangeIsEqual(editor.range, Helpers.editor.retargetRange(expectedRange, editor.post));
});

// see https://github.com/bustlelabs/mobiledoc-kit/issues/306
test('adding/removing bold text between two bold markers works', (assert) => {
  editor = Helpers.editor.buildFromText('*abc*123*def*', {element: editorElement});

  // preconditions
  assert.hasElement('#editor b:contains(abc)');
  assert.hasElement('#editor b:contains(def)');
  assert.hasNoElement('#editor b:contains(123)');

  Helpers.dom.selectText(editor, '123', editorElement);
  editor.run(postEditor => postEditor.toggleMarkup('b'));

  assert.hasElement('#editor b:contains(abc123def)', 'adds B to selection');

  assert.equal(Helpers.dom.getSelectedText(), '123', '123 still selected');

  editor.run(postEditor => postEditor.toggleMarkup('b'));

  assert.hasElement('#editor b:contains(abc)', 'removes B from middle, leaves abc');
  assert.hasElement('#editor b:contains(def)', 'removes B from middle, leaves def');
  assert.hasNoElement('#editor b:contains(123)', 'removes B from middle');
});

test('keypress events when the editor does not have selection are ignored', (assert) => {
  let done = assert.async();
  let expected;
  editor = Helpers.mobiledoc.renderInto(editorElement, ({post, markupSection, marker}) => {
    expected = post([markupSection('p', [marker('abc')])]);
    return post([
      markupSection('p', [marker('abc')])
    ]);
  });

  Helpers.dom.clearSelection();

  Helpers.wait(() => {
    assert.ok(!editor.hasCursor(), 'precond - editor does not have cursor');
    Helpers.dom.insertText(editor, 'v');

    assert.postIsSimilar(editor.post, expected, 'post is not changed');
    done();
  });
});

test('prevent handling newline', (assert) => {
  editor = Helpers.editor.buildFromText('', {element: editorElement});

  editor.willHandleNewline(event => {
    assert.ok(true, 'willHandleNewline should be triggered');
    event.preventDefault();
  });
  let {post: expected} = Helpers.postAbstract.buildFromText(['Line1']);

  Helpers.dom.insertText(editor, 'Line1');
  Helpers.dom.insertText(editor, ENTER);
  assert.postIsSimilar(editor.post, expected);
});
// test('custom wrapper classes', (assert) => {
//   editor = Helpers.editor.buildFromText('[abc,@("name":"my-atom","value":"abc","payload":{}),def,[my-card]]', {element: editorElement, cards, atoms});
//   console.log('*********************************');
//   console.log('*********************************');
//   console.log('*********************************');
//   console.log('*********************************');
//   console.log('*********************************');
//   console.log('*********************************');
//   console.log('*********************************');
//   console.log('*********************************');
//   console.log('*********************************');
//   console.log('*********************************');
//   console.log('>>>>>>>>>>>>>>>',$('#editor')[0]);
//    console.log('*********************************');
//   console.log('*********************************');
//   console.log('*********************************');
//   console.log('*********************************');
//   console.log('*********************************');
//   console.log('*********************************');
//   console.log('*********************************');
//   console.log('*********************************');
//   console.log('*********************************');
//   console.log('*********************************');
  
// });