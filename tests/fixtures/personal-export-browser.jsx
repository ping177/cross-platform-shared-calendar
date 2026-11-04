import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AccountManagementPage } from '../../src/components/AccountManagementPage';
import { personalExportClient } from './personal-export-client.ts';
import { spaceExportClient } from './space-export-client.ts';
import { syntheticActor } from './data-export-synthetic.ts';
import '../../src/styles.css';
const params = new URLSearchParams(location.search);
const f = params.has('multi') ? spaceExportClient(2) : personalExportClient(params.get('empty') ? 0 : 501, 37);
window.personalFixture = f;
const root = createRoot(document.getElementById('root'));
function Fixture() {
  const [user, setUser] = useState(syntheticActor);
  f.setUser = setUser; f.unmount = () => root.unmount();
  return <AccountManagementPage key={user} userId={user} email="synthetic@example.invalid" error="" onBack={() => {}} onSignOut={() => { f.state.user = ''; f.emitAuth(); }} />;
}
root.render(<Fixture />);
