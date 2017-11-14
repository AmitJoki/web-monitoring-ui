import PropTypes from 'prop-types';
import React from 'react';
import {Link, Redirect} from 'react-router-dom';
import WebMonitoringDb from '../services/web-monitoring-db';
import ChangeView from './change-view';
import Loading from './loading';

/**
 * @typedef {Object} PageDetailsProps
 * @property {Page[]} pages
 * @property {Object} user
 */

/**
 * Renders detailed, full-screen view of a page and its versions, changes, etc.
 *
 * @class PageDetails
 * @extends {React.Component}
 * @param {PageDetailsProps} props
 */
export default class PageDetails extends React.Component {
  constructor (props) {
    super(props);
    this.state = { page: null };
    this._annotateChange = this._annotateChange.bind(this);
    this._navigateToChange = this._navigateToChange.bind(this);
  }

  componentWillMount () {
    this._loadPage(this.props.match.params.pageId);
  }

  componentDidMount () {
    window.addEventListener('keydown', this);
  }

  componentWillUnmount () {
    window.removeEventListener('keydown', this);
  }

  /**
   * @param {PageDetailsProps} nextProps
   */
  componentWillReceiveProps (nextProps) {
    const nextPageId = nextProps.match.params.pageId;
    if (nextPageId !== this.props.match.params.pageId) {
      this._loadPage(nextPageId);
    }
  }

  /**
   * This is part of the DOM event handler interface
   * @private
   * @param {DOMEvent} event
   */
  handleEvent (event) {
    if (event.keyCode === 27) {
      this.props.history.push('/');
    }
  }

  /**
   * Save an annotation on a change
   *
   * @param {string} fromVersion ID of the `from` version of the change
   * @param {string} toVersion ID of the `to` version of the change
   * @param {Object} annotation
   */
  _annotateChange (fromVersion, toVersion, annotation) {
    return this.context.api.annotateChange(
      this.state.page.uuid,
      fromVersion,
      toVersion,
      annotation
    );
  }

  render () {
    if (!this.state.page) {
      return (<Loading />);
    }

    // TODO: this HTML should probably be broken up a bit
    return (
      <div className="container-fluid container-page-view">
        <div className="row">
          <div className="col-md-9">
            <header>
              <h2 className="page-title">
                {this.state.page.title}
              </h2>
              <a
                className="diff_page_url"
                href={this.state.page.url}
                target="_blank"
                rel="noopener"
              >
                {this.state.page.url}
              </a>
            </header>
          </div>
          <div className="col-md-3">
            {this._renderPager()}
          </div>
        </div>
        {this._renderChange()}
      </div>
    );
  }

  _renderPager () {
    if (!this.props.pages) {
      return null;
    }
    const allPages = this.props.pages || [];
    const index = allPages.findIndex(page => page.uuid === this.state.page.uuid);
    const previousPage = allPages[index - 1];
    const previousUrl = previousPage ? `/page/${previousPage.uuid}` : '#';
    const nextPage = index >= 0 ? allPages[index + 1] : null;
    const nextUrl = nextPage ? `/page/${nextPage.uuid}` : '#';

    return (
      <nav aria-label="...">
        <ul className="pager">
          <li>
            <Link to={previousUrl} className="pager__previous">
              <i className="fa fa-arrow-left" aria-hidden="true" /> Previous
            </Link>
          </li>
          <li>
            <Link to={nextUrl} className="pager__next">
              Next <i className="fa fa-arrow-right" aria-hidden="true" />
            </Link>
          </li>
        </ul>
      </nav>
    );
  }

  /**
   * When possible, render the appropriate ChangeView. Otherwise:
   * - Redirect to a URL specifying a valid change (if there wasn't one)
   * - Render a message indicating no change to render (if there's no
   *   valid change we could navigate to)
   * @private
   * @returns {JSX.Element}
   */
  _renderChange () {
    /** TODO: should we show 404 for bad versions?
     * If versions are not found we default to latest change.
     */
    const versionData = this._versionsToRender();

    if (!(versionData.from && versionData.to)) {
      let to = versionData.to || this.state.page.versions[0];
      let from = this.state.page.versions.find(
        version => version.capture_time < to.capture_time) || to;

      if (from && to) {
        return <Redirect to={this._getChangeUrl(from, to)} />;
      }

      return <div className="error">No saved versions of this page</div>;
    }

    return (
      <ChangeView
        {...versionData}
        page={this.state.page}
        annotateChange={this._annotateChange}
        user={this.props.user}
        onChangeSelectedVersions={this._navigateToChange}
      />
    );
  }

  _versionsToRender () {
    const [fromId, toId] = (this.props.match.params.change || '').split('..');
    let from = this.state.page.versions.find(v => v.uuid === fromId);
    let to = this.state.page.versions.find(v => v.uuid === toId);

    // Changes with no `to` are invalid, but those where `from` was never
    // specified are OK (it’ll be considered relative to `to`)
    if (!to || fromId && !from) {
      to = from = null;
    }
    return {from, to};
  }

  _loadPage (pageId) {
    // TODO: handle the missing `.versions` collection problem better
    const fromList = this.props.pages && this.props.pages.find(
      (page) => page.uuid === pageId && !!page.versions);

    Promise.resolve(fromList || this.context.api.getPage(pageId))
      .then((page) => {
        this.setState({page});
      });
  }

  _getChangeUrl (from, to, page) {
    const changeId = (from && to) ? `${from.uuid}..${to.uuid}` : '';
    const pageId = page && page.uuid || this.props.match.params.pageId;
    return `/page/${pageId}/${changeId}`;
  }

  _navigateToChange (from, to, page, replace = false) {
    const url = this._getChangeUrl(from, to, page);
    this.props.history[replace ? 'replace' : 'push'](url);
  }
}

PageDetails.contextTypes = {
  api: PropTypes.instanceOf(WebMonitoringDb)
};
