#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { EndpointStack } from '../lib/tiler-stack';


const app = new cdk.App();

const endpointStack = new EndpointStack(app, 'cogsstack', {
  crossRegionReferences: true,
});

