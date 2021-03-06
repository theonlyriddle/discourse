import DiscourseController from 'discourse/controllers/controller';
import loadScript from 'discourse/lib/load-script';

export default DiscourseController.extend({
  needs: ['topic', 'composer'],

  _loadSanitizer: function() {
    loadScript('defer/html-sanitizer-bundle');
  }.on('init'),

  /**
    If the buffer is cleared, clear out other state (post)
  **/
  bufferChanged: function() {
    if (this.blank('buffer')) this.set('post', null);
  }.observes('buffer'),

  /**
    Save the currently selected text and displays the
    "quote reply" button

    @method selectText
  **/
  selectText: function(postId) {
    // anonymous users cannot "quote-reply"
    if (!Discourse.User.current()) return;

    // don't display the "quote-reply" button if we can't create a post
    if (!this.get('controllers.topic.model.details.can_create_post')) return;

    var selection = window.getSelection();
    // no selections
    if (selection.rangeCount === 0) return;

    // retrieve the selected range
    var range = selection.getRangeAt(0),
        cloned = range.cloneRange(),
        $ancestor = $(range.commonAncestorContainer);

    if ($ancestor.closest('.cooked').length === 0) {
      this.set('buffer', '');
      return;
    }

    var selectedText = Discourse.Utilities.selectedText();
    if (this.get('buffer') === selectedText) return;

    // we need to retrieve the post data from the posts collection in the topic controller
    var postStream = this.get('controllers.topic.postStream');
    this.set('post', postStream.findLoadedPost(postId));
    this.set('buffer', selectedText);

    // create a marker element
    var markerElement = document.createElement("span");
    // containing a single invisible character
    markerElement.appendChild(document.createTextNode("\u{feff}"));

    // collapse the range at the beginning/end of the selection
    range.collapse(!Discourse.Mobile.isMobileDevice);
    // and insert it at the start of our selection range
    range.insertNode(markerElement);

    // retrieve the position of the market
    var markerOffset = $(markerElement).offset(),
        $quoteButton = $('.quote-button');

    // remove the marker
    markerElement.parentNode.removeChild(markerElement);

    // work around Chrome that would sometimes lose the selection
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(cloned);

    // move the quote button above the marker
    Em.run.schedule('afterRender', function() {
      var top = markerOffset.top;
      var left = markerOffset.left;

      if (Discourse.Mobile.isMobileDevice) {
        top = top + 20;
        left = Math.min(left + 10, $(window).width() - $quoteButton.outerWidth());
      } else {
        top = top - $quoteButton.outerHeight() - 5;
      }

      $quoteButton.offset({ top: top, left: left });
    });
  },

  /**
    Quote the currently selected text

    @method quoteText
  **/
  quoteText: function() {
    var post = this.get('post');
    var composerController = this.get('controllers.composer');
    var composerOpts = {
      action: Discourse.Composer.REPLY,
      draftKey: this.get('post.topic.draft_key')
    };

    if(post.get('post_number') === 1) {
      composerOpts.topic = post.get("topic");
    } else {
      composerOpts.post = post;
    }

    // If the composer is associated with a different post, we don't change it.
    var composerPost = composerController.get('content.post');
    if (composerPost && (composerPost.get('id') !== this.get('post.id'))) {
      composerOpts.post = composerPost;
    }

    var buffer = this.get('buffer');
    var quotedText = Discourse.Quote.build(post, buffer);
    composerOpts.quote = quotedText;
    if (composerController.get('content.viewOpen') || composerController.get('content.viewDraft')) {
      composerController.appendBlockAtCursor(quotedText.trim());
    } else {
      composerController.open(composerOpts);
    }
    this.set('buffer', '');
    return false;
  },

  /**
    Deselect the currently selected text

    @method deselectText
  **/
  deselectText: function() {
    // clear selected text
    window.getSelection().removeAllRanges();
    // clean up the buffer
    this.set('buffer', '');
  }

});
