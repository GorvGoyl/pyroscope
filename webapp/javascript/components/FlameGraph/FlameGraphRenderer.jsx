/* eslint-disable react/no-unused-state */
/* eslint-disable no-bitwise */
/* eslint-disable react/no-access-state-in-setstate */
/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable react/destructuring-assignment */
/* eslint-disable no-nested-ternary */

import React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import clsx from 'clsx';
import { Maybe } from '@utils/fp';
import Graph from './FlameGraphComponent';
import ProfilerTable from '../ProfilerTable';
import Toolbar from '../Toolbar';
import { createFF } from '../../util/flamebearer';
import styles from './FlamegraphRenderer.module.css';

import ExportData from '../ExportData';

import {
  toggleLinkedSearch,
  setSearchQuery,
} from '../../redux/reducers/search';

class FlameGraphRenderer extends React.Component {
  // TODO: this could come from some other state
  // eg localstorage
  initialFlamegraphState = {
    focusedNode: Maybe.nothing(),
    zoom: Maybe.nothing(),
  };

  constructor(props) {
    super();
    this.state = {
      isFlamegraphDirty: false,
      sortBy: 'self',
      sortByDirection: 'desc',
      view: 'both',
      viewDiff: props.viewType === 'diff' ? 'diff' : undefined,
      fitMode: props.fitMode ? props.fitMode : 'HEAD',
      flamebearer: props.flamebearer,

      // query used in the 'search' checkbox
      highlightQuery: '',

      flamegraphConfigs: this.initialFlamegraphState,
    };

    // for situations like in grafana we only display the flamegraph
    // 'both' | 'flamegraph' | 'table'
    this.display = props.display !== undefined ? props.display : 'both';
  }

  componentDidUpdate(prevProps, prevState) {
    const previousFlamebearer = prevProps.flamebearer;
    const actualFlamebearer = this.props.flamebearer;
    if (previousFlamebearer !== actualFlamebearer) {
      this.updateFlamebearerData();
    }

    // flamegraph configs changed
    if (prevState.flamegraphConfigs !== this.state.flamegraphConfigs) {
      this.updateFlamegraphDirtiness();
    }

    if (this.props.isSearchLinked) {
      if (this.props.linkedSearchQuery !== prevState.highlightQuery) {
        // disable eslint rule to allow updating state inside componentDidUpdate
        // eslint-disable-next-line react/no-did-update-set-state
        this.setState({
          highlightQuery: this.props.linkedSearchQuery,
        });
      }
      if (this.props.resetLinkedSearchSide === this.props.viewSide) {
        // eslint-disable-next-line react/no-did-update-set-state
        this.setState({
          highlightQuery: '',
        });
        this.props.actions.toggleLinkedSearch('both');
      }
    }
  }

  componentWillUnmount() {
    this.abortCurrentJSONController();
  }

  updateFitMode = (newFitMode) => {
    this.setState({
      fitMode: newFitMode,
    });
  };

  updateFlamegraphDirtiness = () => {
    const isDirty = this.isDirty();

    this.setState({
      isFlamegraphDirty: isDirty,
    });
  };

  handleSearchChange = (e) => {
    this.setState({
      highlightQuery: e,
    });

    if (this.props.isSearchLinked) {
      this.props.actions.setSearchQuery(e);
    }
  };

  onReset = () => {
    this.setState({
      ...this.state,
      flamegraphConfigs: {
        ...this.state.flamegraphConfigs,
        ...this.initialFlamegraphState,
      },
    });
  };

  updateView = (newView) => {
    this.setState({
      view: newView,
    });
  };

  updateViewDiff = (newView) => {
    this.setState({
      viewDiff: newView,
    });
  };

  onFlamegraphZoom = (bar) => {
    // zooming on the topmost bar is equivalent to resetting to the original state
    if (bar.isJust && bar.value.i === 0 && bar.value.j === 0) {
      this.onReset();
      return;
    }

    // otherwise just pass it up to the state
    // doesn't matter if it's some or none
    this.setState({
      ...this.state,
      flamegraphConfigs: {
        ...this.state.flamegraphConfigs,
        zoom: bar,
      },
    });
  };

  onFocusOnNode = (i, j) => {
    if (i === 0 && j === 0) {
      this.onReset();
      return;
    }

    let flamegraphConfigs = { ...this.state.flamegraphConfigs };

    // reset zoom if we are focusing below the zoom
    // or the same one we were zoomed
    const { zoom } = this.state.flamegraphConfigs;
    if (zoom.isJust) {
      if (zoom.value.i <= i) {
        flamegraphConfigs = {
          ...flamegraphConfigs,
          zoom: this.initialFlamegraphState.zoom,
        };
      }
    }

    this.setState({
      ...this.state,
      flamegraphConfigs: {
        ...flamegraphConfigs,
        focusedNode: Maybe.just({ i, j }),
      },
    });
  };

  updateSortBy = (newSortBy) => {
    let dir = this.state.sortByDirection;
    if (this.state.sortBy === newSortBy) {
      dir = dir === 'asc' ? 'desc' : 'asc';
    } else {
      dir = 'desc';
    }
    this.setState({
      sortBy: newSortBy,
      sortByDirection: dir,
    });
  };

  isDirty = () => {
    // TODO: is this a good idea?
    return (
      JSON.stringify(this.initialFlamegraphState) !==
      JSON.stringify(this.state.flamegraphConfigs)
    );
  };

  shouldShowToolbar() {
    // default to true
    return this.props.showToolbar !== undefined ? this.props.showToolbar : true;
  }

  updateFlamebearerData() {
    this.setState({
      flamebearer: this.props.flamebearer,
    });
  }

  parseFormat(format) {
    return createFF(format || this.state.format);
  }

  abortCurrentJSONController() {
    if (this.currentJSONController) {
      this.currentJSONController.abort();
    }
  }

  render = () => {
    // This is necessary because the order switches depending on single vs comparison view
    const tablePane = (
      <div
        key="table-pane"
        className={clsx('pane', {
          hidden:
            this.state.view === 'icicle' ||
            !this.state.flamebearer ||
            this.state.flamebearer.names.length <= 1,
          'vertical-orientation': this.props.viewType === 'double',
        })}
      >
        <ProfilerTable
          data-testid="table-view"
          flamebearer={this.state.flamebearer}
          sortByDirection={this.state.sortByDirection}
          sortBy={this.state.sortBy}
          updateSortBy={this.updateSortBy}
          view={this.state.view}
          viewDiff={this.state.viewDiff}
          fitMode={this.state.fitMode}
          isFlamegraphDirty={this.state.isFlamegraphDirty}
        />
      </div>
    );
    const dataExists =
      this.state.view !== 'table' ||
      (this.state.flamebearer && this.state.flamebearer.names.length <= 1);

    const flamegraphDataTestId = figureFlamegraphDataTestId(
      this.props.viewType,
      this.props.viewSide
    );

    const exportData = () => {
      if (!this.state.flamebearer) {
        return <ExportData />;
      }

      if (!this.props.rawFlamegraph) {
        return <ExportData />;
      }

      // we only want to download single ones
      if (this.state.flamebearer.format === 'double') {
        return <ExportData />;
      }

      return <ExportData exportFlamebearer={this.props.rawFlamegraph} />;
    };

    const flameGraphPane =
      this.state.flamebearer && dataExists ? (
        <Graph
          key="flamegraph-pane"
          data-testid={flamegraphDataTestId}
          flamebearer={this.state.flamebearer}
          format={this.parseFormat(this.state.flamebearer.format)}
          view={this.state.view}
          ExportData={exportData}
          highlightQuery={this.state.highlightQuery}
          fitMode={this.state.fitMode}
          viewType={this.props.viewType}
          zoom={this.state.flamegraphConfigs.zoom}
          focusedNode={this.state.flamegraphConfigs.focusedNode}
          label={this.props.query}
          onZoom={this.onFlamegraphZoom}
          onFocusOnNode={this.onFocusOnNode}
          onReset={this.onReset}
          isDirty={this.isDirty}
        />
      ) : null;

    const panes = decidePanesOrder(
      this.props.viewType,
      this.display,
      flameGraphPane,
      tablePane
    );

    const toggleLinkedSearchAction = () => {
      if (this.props.isSearchLinked) {
        this.props.actions.toggleLinkedSearch(this.props.viewSide);
      } else {
        this.props.actions.setSearchQuery(this.state.highlightQuery);
        this.props.actions.toggleLinkedSearch('both');
      }
    };

    return (
      <div
        className={clsx('canvas-renderer', {
          double: this.props.viewType === 'double',
        })}
      >
        <div className="canvas-container">
          {this.shouldShowToolbar() && (
            <Toolbar
              view={this.state.view}
              viewDiff={this.state.viewDiff}
              display={this.props.display}
              handleSearchChange={this.handleSearchChange}
              reset={this.onReset}
              updateView={this.updateView}
              updateViewDiff={this.updateViewDiff}
              updateFitMode={this.updateFitMode}
              fitMode={this.state.fitMode}
              isFlamegraphDirty={this.state.isFlamegraphDirty}
              selectedNode={this.state.flamegraphConfigs.zoom}
              onFocusOnSubtree={(i, j) => {
                this.onFocusOnNode(i, j);
              }}
              viewType={this.props.viewType}
              viewSide={this.props.viewSide}
              toggleLinkedSearch={toggleLinkedSearchAction}
            />
          )}
          {this.props.children}
          <div
            className={`${styles.flamegraphContainer} ${clsx(
              'flamegraph-container panes-wrapper',
              {
                'vertical-orientation': this.props.viewType === 'double',
              }
            )}`}
          >
            {panes.map((pane) => pane)}
          </div>
        </div>
      </div>
    );
  };
}

function decidePanesOrder(viewType, display, flamegraphPane, tablePane) {
  switch (display) {
    case 'table': {
      return [tablePane];
    }
    case 'flamegraph': {
      return [flamegraphPane];
    }

    case 'both':
    default: {
      switch (viewType) {
        case 'double':
          return [flamegraphPane, tablePane];
        default:
          return [tablePane, flamegraphPane];
      }
    }
  }
}

function figureFlamegraphDataTestId(viewType, viewSide) {
  switch (viewType) {
    case 'single': {
      return `flamegraph-single`;
    }
    case 'double': {
      return `flamegraph-comparison-${viewSide}`;
    }
    case 'diff': {
      return `flamegraph-diff`;
    }

    default:
      throw new Error(`Unsupported viewType: ${viewType}`);
  }
}

const mapStateToProps = (state) => ({
  isSearchLinked: state.search.isSearchLinked,
  linkedSearchQuery: state.search.linkedSearchQuery,
  resetLinkedSearchSide: state.search.resetLinkedSearchSide,
});

const mapDispatchToProps = (dispatch) => ({
  actions: bindActionCreators(
    {
      toggleLinkedSearch,
      setSearchQuery,
    },
    dispatch
  ),
});

export default connect(mapStateToProps, mapDispatchToProps)(FlameGraphRenderer);
