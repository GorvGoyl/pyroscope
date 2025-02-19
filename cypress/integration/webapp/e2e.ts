// Following tests should have NO mocking involved.
// The objective involve validating server/webapp interaction is working correctly

import * as moment from 'moment';

function randomName() {
  const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const num = 5;

  return Array(num)
    .fill(0)
    .map(() => letters.substr(Math.floor(Math.random() * num + 1), 1))
    .join('');
}

describe('E2E Tests', () => {
  // TODO:
  // instead of generating a new application
  // delete the old one?
  let appName = '';
  // use a fixed time IN THE DAY so that the hours in the timeline are always the same
  const t0 = moment().startOf('day').unix();
  const t1 = moment().startOf('day').add(3, 'minutes').unix();
  const t2 = moment().startOf('day').add(5, 'minutes').unix();
  const t3 = moment().startOf('day').add(6, 'minutes').unix();
  const t4 = moment().startOf('day').add(10, 'minutes').unix();

  before(() => {
    appName = randomName();

    // populate the db with 2 items
    //
    // it's important that they are recent
    // otherwise the database may just drop them
    // if they are older than the retention date

    cy.request({
      method: 'POST',
      url: `/ingest?name=${appName}&sampleRate=100&from=${t1}&until=${t1}`,
      body: 'foo;bar 100',
    });

    cy.request({
      method: 'POST',
      url: `/ingest?name=${appName}&sampleRate=100&from=${t3}&until=${t3}`,
      body: 'foo;bar;baz 10',
    });
  });

  it('tests single view', () => {
    const params = new URLSearchParams();
    params.set('query', appName);
    params.set('from', t0);
    params.set('until', t4);

    cy.visit(`/?${params.toString()}`);

    cy.findByTestId('flamegraph-canvas').matchImageSnapshot(
      `e2e-single-flamegraph`
    );
  });

  it('tests /comparison view', () => {
    const params = new URLSearchParams();
    params.set('query', appName);
    params.set('from', t0);
    params.set('until', t4);
    params.set('leftFrom', t0);
    params.set('leftUntil', t2);
    params.set('rightFrom', t2);
    params.set('rightTo', t4);

    cy.visit(`/comparison?${params.toString()}`);

    const findFlamegraph = (n: number) => {
      const query = `> :nth-child(${n})`;

      return cy.findByTestId('comparison-container').find(query);
    };

    // flamegraph 1 (the left one)
    findFlamegraph(1)
      .findByTestId('flamegraph-canvas')
      .matchImageSnapshot(`e2e-comparison-flamegraph-left`);

    // flamegraph 2 (the right one)
    findFlamegraph(2)
      .findByTestId('flamegraph-canvas')
      .matchImageSnapshot(`e2e-comparison-flamegraph-right`);
  });

  it('tests /comparison-diff view', () => {
    const params = new URLSearchParams();
    params.set('query', appName);
    params.set('from', t0);
    params.set('until', t4);
    params.set('leftFrom', t0);
    params.set('leftUntil', t2);
    params.set('rightFrom', t2);
    params.set('rightTo', t4);

    cy.visit(`/comparison-diff?${params.toString()}`);

    cy.findByTestId('flamegraph-canvas').matchImageSnapshot(
      `e2e-comparison-diff-flamegraph`
    );
  });
});
