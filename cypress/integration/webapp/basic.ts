import { BAR_HEIGHT } from '../../../webapp/javascript/components/FlameGraph/FlameGraphComponent/constants';

// / <reference types="cypress" />
describe('basic test', () => {
  it('successfully loads', () => {
    cy.visit('/');
    cy.title().should('eq', 'Pyroscope');
  });

  it('changes app via the application dropdown', () => {
    const basePath = Cypress.env('basePath') || '';
    // While the initial values come from the backend
    // We refresh it here so that we can mock with specific values
    cy.intercept(`${basePath}**/label-values*`, {
      fixture: 'appNames.json',
    }).as('labelValues');

    cy.visit('/');

    cy.findByLabelText(/Refresh apps/i).click();
    cy.wait(`@labelValues`);

    cy.get('.navbar').findByRole('button', { expanded: false }).click();

    // For some reason couldn't find the appropriate query
    cy.findAllByRole('menuitem').then((items) => {
      items.each((i, item) => {
        if (item.innerText.includes('pyroscope.server.inuse_space')) {
          item.click();
        }
      });
    });

    cy.location().then((loc) => {
      const queryParams = new URLSearchParams(loc.search);
      expect(queryParams.get('query')).to.eq('pyroscope.server.inuse_space{}');
    });
  });

  it('highlights nodes that match a search query', () => {
    cy.intercept('**/render*', {
      fixture: 'simple-golang-app-cpu.json',
    }).as('render');

    cy.visit('/');

    cy.findByTestId('flamegraph-search').type('main');

    // if we take a screenshot right away, the canvas may not have been re-renderer yet
    // therefore we also assert for this attribute
    // which cypress will retry a few times if necessary
    cy.findByTestId('flamegraph-canvas').get('[data-highlightquery="main"]');

    cy.findByTestId('flamegraph-canvas').matchImageSnapshot(
      'simple-golang-app-cpu-highlight'
    );
  });

  it('Inputbox text should sync when search is linked', () => {
    cy.intercept('**/render*', {
      fixture: 'simple-golang-app-cpu.json',
    }).as('render');

    cy.visit('/comparison');

    cy.findByTestId('link-search-btn-left').click();
    cy.findByTestId('flamegraph-search-left').type('main');
    cy.findByTestId('flamegraph-search-right').should('have.value', 'main');
  });

  it('view buttons should change view when clicked', () => {
    // mock data since the first preselected application
    // could have no data
    cy.intercept('**/render*', {
      fixture: 'render.json',
      times: 1,
    }).as('render1');

    cy.visit('/');

    cy.findByRole('combobox', { name: /view/ }).select('Table');
    cy.findByTestId('table-view').should('be.visible');
    cy.findByTestId('flamegraph-view').should('not.exist');

    cy.findByRole('combobox', { name: /view/ }).select('Both');
    cy.findByTestId('table-view').should('be.visible');
    cy.findByTestId('flamegraph-view').should('be.visible');

    cy.findByRole('combobox', { name: /view/ }).select('Flame');
    cy.findByTestId('table-view').should('not.be.visible');
    cy.findByTestId('flamegraph-view').should('be.visible');
  });

  it('sorting is working', () => {
    /**
     * @param row 'first' | 'last'
     * @param column 'location' | 'self' | 'total'
     */

    const columns = {
      location: {
        index: 1,
        selector: '.symbol-name',
      },
      self: {
        index: 2,
        selector: 'span',
      },
      total: {
        index: 3,
        selector: 'span',
      },
    };

    const sortColumn = (columnIndex) =>
      cy
        .findByTestId('table-view')
        .find(`thead > tr > :nth-child(${columnIndex})`)
        .click();

    const getCellContent = (row, column) => {
      const query = `tbody > :nth-child(${row}) > :nth-child(${column.index}) > ${column.selector}`;
      return cy
        .findByTestId('table-view')
        .find(query)
        .then((cell) => cell[0].innerText);
    };

    cy.intercept('**/render*', {
      fixture: 'render.json',
      times: 1,
    }).as('render');

    cy.visit('/');

    cy.findByTestId('table-view')
      .find('tbody > tr')
      .then((rows) => {
        const first = 1;
        const last = rows.length;

        // sort by location desc
        sortColumn(columns.location.index);
        getCellContent(first, columns.location).should('eq', 'function_6');
        getCellContent(last, columns.location).should('eq', 'function_0');

        // sort by location asc
        sortColumn(columns.location.index);
        getCellContent(first, columns.location).should('eq', 'function_0');
        getCellContent(last, columns.location).should('eq', 'function_6');

        // sort by self desc
        sortColumn(columns.self.index);
        getCellContent(first, columns.self).should('eq', '5.00 seconds');
        getCellContent(last, columns.self).should('eq', '0.55 seconds');

        // sort by self asc
        sortColumn(columns.self.index);
        getCellContent(first, columns.self).should('eq', '0.55 seconds');
        getCellContent(last, columns.self).should('eq', '5.00 seconds');

        // sort by total desc
        sortColumn(columns.total.index);
        getCellContent(first, columns.total).should('eq', '5.16 seconds');
        getCellContent(last, columns.total).should('eq', '0.50 seconds');

        // sort by total asc
        sortColumn(columns.total.index);
        getCellContent(first, columns.total).should('eq', '0.50 seconds');
        getCellContent(last, columns.total).should('eq', '5.16 seconds');
      });
  });

  it('validates "Reset View" button works', () => {
    cy.intercept('**/render*', {
      fixture: 'simple-golang-app-cpu.json',
    }).as('render');

    cy.visit('/');

    cy.findByTestId('reset-view').should('not.be.enabled');
    cy.findByTestId('flamegraph-canvas').click(0, BAR_HEIGHT * 2);
    cy.findByTestId('reset-view').should('be.visible');
    cy.findByTestId('reset-view').click();
    cy.findByTestId('reset-view').should('not.be.enabled');
  });

  describe('tooltip', () => {
    it('works in single view', () => {
      cy.intercept('**/render*', {
        fixture: 'simple-golang-app-cpu.json',
      }).as('render');

      cy.visit('/');

      cy.findByTestId('flamegraph-tooltip').should('not.be.visible');

      cy.findByTestId('flamegraph-canvas').trigger('mousemove', 0, 0);
      cy.findByTestId('flamegraph-tooltip').should('be.visible');

      cy.findByTestId('flamegraph-tooltip-title').should('have.text', 'total');
      cy.findByTestId('flamegraph-tooltip-body').should(
        'have.text',
        '100%, 988 samples, 9.88 seconds'
      );

      cy.findByTestId('flamegraph-canvas').trigger('mouseout');
      cy.findByTestId('flamegraph-tooltip').should('not.be.visible');
    });

    it('works in comparison view', () => {
      const findFlamegraph = (n: number) => {
        const query = `> :nth-child(${n})`;

        return cy.findByTestId('comparison-container').find(query);
      };

      cy.intercept('**/render*from=1633024300&until=1633024300*', {
        fixture: 'simple-golang-app-cpu.json',
        times: 1,
      }).as('render-right');

      cy.intercept('**/render*from=1633024290&until=1633024290*', {
        fixture: 'simple-golang-app-cpu2.json',
        times: 1,
      }).as('render-left');

      cy.visit(
        '/comparison?query=simple.golang.app.cpu%7B%7D&from=1633024298&until=1633024302&leftFrom=1633024290&leftUntil=1633024290&rightFrom=1633024300&rightUntil=1633024300'
      );

      cy.wait('@render-right');
      cy.wait('@render-left');

      // flamegraph 1 (the left one)
      findFlamegraph(1)
        .findByTestId('flamegraph-tooltip')
        .should('not.be.visible');

      findFlamegraph(1)
        .findByTestId('flamegraph-canvas')
        .trigger('mousemove', 0, 0);

      findFlamegraph(1).findByTestId('flamegraph-tooltip').should('be.visible');

      findFlamegraph(1)
        .findByTestId('flamegraph-tooltip-title')
        .should('have.text', 'total');
      findFlamegraph(1)
        .findByTestId('flamegraph-tooltip-body')
        .should('have.text', '100%, 991 samples, 9.91 seconds');

      findFlamegraph(1).findByTestId('flamegraph-canvas').trigger('mouseout');
      findFlamegraph(1)
        .findByTestId('flamegraph-tooltip')
        .should('not.be.visible');

      // flamegraph 2 (right one)
      findFlamegraph(2)
        .findByTestId('flamegraph-tooltip')
        .should('not.be.visible');

      findFlamegraph(2)
        .findByTestId('flamegraph-canvas')
        .trigger('mousemove', 0, 0);

      findFlamegraph(2).findByTestId('flamegraph-tooltip').should('be.visible');

      findFlamegraph(2)
        .findByTestId('flamegraph-tooltip-title')
        .should('have.text', 'total');
      findFlamegraph(2)
        .findByTestId('flamegraph-tooltip-body')
        .should('have.text', '100%, 988 samples, 9.88 seconds');

      findFlamegraph(2).findByTestId('flamegraph-canvas').trigger('mouseout');
      findFlamegraph(2)
        .findByTestId('flamegraph-tooltip')
        .should('not.be.visible');
    });

    it('works in diff view', () => {
      cy.intercept('**/render*', {
        fixture: 'simple-golang-app-cpu-diff.json',
        times: 1,
      }).as('render');

      cy.visit(
        '/comparison-diff?query=simple.golang.app.cpu%7B%7D&from=1633024298&until=1633024302&leftFrom=1633024290&leftUntil=1633024290&rightFrom=1633024300&rightUntil=1633024300'
      );

      cy.wait('@render');

      cy.findByTestId('flamegraph-tooltip').should('not.be.visible');

      cy.findByTestId('flamegraph-canvas').trigger('mousemove', 0, 0);
      cy.findByTestId('flamegraph-tooltip').should('be.visible');

      cy.findByTestId('flamegraph-tooltip-title').should('have.text', 'total');
      cy.findByTestId('flamegraph-tooltip-left').should(
        'have.text',
        'Left: 991 samples, 9.91 seconds (100%)'
      );
      cy.findByTestId('flamegraph-tooltip-right').should(
        'have.text',
        'Right: 987 samples, 9.87 seconds (100%)'
      );
    });
  });

  describe('highlight', () => {
    it('works in diff view', () => {
      cy.intercept('**/render*', {
        fixture: 'simple-golang-app-cpu-diff.json',
        times: 1,
      }).as('render');

      cy.visit(
        '/comparison-diff?query=simple.golang.app.cpu%7B%7D&from=1633024298&until=1633024302&leftFrom=1633024290&leftUntil=1633024290&rightFrom=1633024300&rightUntil=1633024300'
      );

      cy.wait('@render');

      cy.findByTestId('flamegraph-highlight').should('not.be.visible');

      cy.findByTestId('flamegraph-canvas').trigger('mousemove', 0, 0);
      cy.findByTestId('flamegraph-highlight').should('be.visible');
    });
  });

  describe('contextmenu', () => {
    it("it works when 'clear view' is clicked", () => {
      cy.intercept('**/render*', {
        fixture: 'simple-golang-app-cpu.json',
        times: 1,
      }).as('render');

      cy.visit('/');

      // until we focus on a specific, it should not be enabled
      cy.findByTestId('flamegraph-canvas').rightclick();
      cy.findByRole('menuitem', { name: /Reset View/ }).should(
        'have.attr',
        'aria-disabled',
        'true'
      );

      // click on the second item
      cy.findByTestId('flamegraph-canvas').click(0, BAR_HEIGHT * 2);
      cy.findByTestId('flamegraph-canvas').rightclick();
      cy.findByRole('menuitem', { name: /Reset View/ }).should(
        'not.have.attr',
        'aria-disabled'
      );
      cy.findByRole('menuitem', { name: /Reset View/ }).click();
      // TODO assert that it was indeed reset?

      // should be disabled again
      cy.findByTestId('flamegraph-canvas').rightclick();
      cy.findByRole('menuitem', { name: /Reset View/ }).should(
        'have.attr',
        'aria-disabled',
        'true'
      );
    });
  });
});
