import React from 'react';
import PropTypes from 'prop-types';
import filter from 'lodash/filter';
import classNames from 'classnames';
const domPurify = require('dompurify')
let domPurifyImp = null;

import Remarkable from 'remarkable';
import embedjs from 'embedjs';
import { jsonParse } from '../../helpers/formatter';
import sanitizeConfig from '../../vendor/SanitizeConfig';
import { imageRegex, hedeRefRegex, seeRefRegex, hedeRefRegexInner, removeHedeReference, removeHedeReference2 } from '../../helpers/regexHelpers';
import htmlReady from '../../vendor/steemitHtmlReady';
import PostFeedEmbed from './PostFeedEmbed';
import Cookie from 'js-cookie';

import './Body.less';

export const remarkable = new Remarkable('commonmark', {
  html: true, // remarkable renders first then sanitize runs...
  breaks: true,
  linkify: false, // linkify is done locally
  typographer: false, // https://github.com/jonschlinkert/remarkable/issues/142#issuecomment-221546793
  quotes: '“”‘’',
  
});


// Should return text(html) if returnType is text
// Should return Object(React Compatible) if returnType is Object
export function getHtml(body, jsonMetadata = {}, returnType = 'Object') {
  const parsedJsonMetadata = jsonMetadata || {};
  parsedJsonMetadata.image = parsedJsonMetadata.image || [];

  let parsedBody = body.replace(/<!--([\s\S]+?)(-->|$)/g, '(html comment removed: $1)');

  parsedBody.replace(imageRegex, (img) => {
    if (filter(parsedJsonMetadata.image, i => i.indexOf(img) !== -1).length === 0) {
      parsedJsonMetadata.image.push(img);
    }
  });

  const languageReqUrl = Cookie.get("language2") ? `&l=${Cookie.get("language2")}` : "";

  parsedBody = parsedBody.replace(hedeRefRegex, (m, ref) => {
    return `(hede: [${ref}](/?q=${encodeURIComponent(ref)}${languageReqUrl}))`;
  });
  parsedBody = parsedBody.replace(seeRefRegex, (m, ref) => {
    return `(see: [${ref}](/?q=${encodeURIComponent(ref)}${languageReqUrl}))`;
  });
  parsedBody = parsedBody.replace(hedeRefRegexInner, (m, ref) => {
    return `[${ref}](/?q=${encodeURIComponent(ref)}${languageReqUrl})`;
  });

  parsedBody = parsedBody.replace(removeHedeReference2, "").replace(/<br\s?\/\>\s*$/, "");

//onclick="return window.redirectToTitle(${ref});"
  
  const htmlReadyOptions = { mutate: true, resolveIframe: returnType === 'text' };
  parsedBody = remarkable.render(parsedBody);
  parsedBody = htmlReady(parsedBody, htmlReadyOptions).html;

  if(!domPurifyImp)
      domPurifyImp = domPurify(window);

  // Add a hook to make all links open a new window
  domPurifyImp.addHook('afterSanitizeAttributes', function(node) {
   
    // set all elements owning target to target=_blank
    if ('target' in node) {
       if(node.getAttribute("href")[0]==='/'){
         node.setAttribute('onclick', 'event.preventDefault(); window.myHistory.push("'+node.getAttribute("href")+'");');
         return;
       }
       node.setAttribute('target','_blank');
    }
    // set non-HTML/MathML links to xlink:show=new
    if (!node.hasAttribute('target') 
        && (node.hasAttribute('xlink:href') 
            || node.hasAttribute('href'))) {
        node.setAttribute('xlink:show', 'new');
    }
  });

  const options = {ALLOWED_TAGS:  ["br", "blockquote", "img", "link", "a", "p", "iframe", "ul", "ol", "li", "table", "thead", "tr", "td", "h1", "h2", "h3", "h4", "h5", "h6"]};
  
  parsedBody = domPurifyImp.sanitize(parsedBody, options);

  
  if (returnType === 'text') {
    return parsedBody;
  }

  const sections = [];

  const splittedBody = parsedBody.split('~~~ embed:');
  for (let i = 0; i < splittedBody.length; i += 1) {
    let section = splittedBody[i];

    const match = section.match(/^([A-Za-z0-9_-]+) ([A-Za-z]+) (\S+) ~~~/);
    if (match && match.length >= 4) {
      const id = match[1];
      const type = match[2];
      const link = match[3];
      const embed = embedjs.get(link, { width: '100%', height: 400, autoplay: true });
      sections.push(<PostFeedEmbed key={`embed-a-${i}`} embed={embed} />);
      section = section.substring(`${id} ${type} ${link} ~~~`.length);
    }
    if (section !== '') {
      // eslint-disable-next-line react/no-danger
      sections.push(<div key={`embed-b-${i}`} dangerouslySetInnerHTML={{ __html: section }} />);
    }
  }
  return sections;
}

const Body = (props) => {
  const htmlSections = getHtml(props.body, props.jsonMetadata);
  return (
    <div className={classNames('Body', { 'Body--full': props.full })}>
      {htmlSections}
    </div>
  );
};

Body.propTypes = {
  body: PropTypes.string,
  jsonMetadata: PropTypes.object,
  full: PropTypes.bool,
  isComment: PropTypes.bool
};

Body.defaultProps = {
  body: '',
  jsonMetadata: {},
  full: false,
  isComment: false
};

export default Body;
