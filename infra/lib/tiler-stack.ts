import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as path from 'path'
import { HttpApi } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { Tracing } from 'aws-cdk-lib/aws-lambda';

export class EndpointStack extends cdk.Stack {
    
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    cdk.Tags.of(this).add('environment:type', 'development')
    cdk.Tags.of(this).add('service:name', 'cogs-tiler')

    const bucket = s3.Bucket.fromBucketName(this, 'databucket', 'xxx')

    const role = new iam.Role(this, 'lambda-role', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    })
    role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"));
    
    bucket.grantRead(role)

    const tilelambda = new lambda.Function(this, 'tiler-lambda', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'handler.handler',
      code: lambda.Code.fromDockerBuild(path.resolve(__dirname, '../..'), { file: "lambda/Dockerfile"}),
      architecture: lambda.Architecture.X86_64,
      memorySize: 2048,
      tracing: Tracing.ACTIVE,
      insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_229_0,
      // layers: [
      //   lambda.LayerVersion.fromLayerVersionArn(this, 'powertools', 'arn:aws:lambda:ap-southeast-2:017000801446:layer:AWSLambdaPowertoolsPythonV2:68')
      // ],
      // environment: {
      //   "POWERTOOLS_SERVICE_NAME": "cogs-tiler"
      // },
      timeout: cdk.Duration.seconds(15),
      role,
    })

    const api = new HttpApi(this, 'cogs-tiler-api', {
      defaultIntegration: new HttpLambdaIntegration('cogs-tiler-lambda', tilelambda),
    })

    const websiteBucket = new s3.Bucket(this, 'websiteBucket', {  
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    })


    const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'oai');


    const distribution = new cloudfront.Distribution(this, 'cogs-tiler-distribution', {
      enableLogging: true,
      defaultRootObject: 'index.html',
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      defaultBehavior: {
        origin: new origins.S3Origin(websiteBucket, { originAccessIdentity }),
        compress: true,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,  
      },
      additionalBehaviors: {
        '/WebMercatorQuad/*': {
          origin: new origins.HttpOrigin(cdk.Fn.select(1, cdk.Fn.split('://', api.apiEndpoint!))),
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,  
          responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS_WITH_PREFLIGHT,
          compress: true,
        },
        '/tiles/*': {
          origin: new origins.HttpOrigin(cdk.Fn.select(1, cdk.Fn.split('://', api.apiEndpoint!))),
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,  
          responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS_WITH_PREFLIGHT,
          compress: true,
          // trustedKeyGroups: [
          //   keyGroup,
          // ],
        },
        '/colorMaps/*': {
          origin: new origins.HttpOrigin(cdk.Fn.select(1, cdk.Fn.split('://', api.apiEndpoint!))),
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,  
          responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS_WITH_PREFLIGHT,
          compress: true,
        },
        
      }
    })
    websiteBucket.grantRead(originAccessIdentity);

    new cdk.CfnOutput(this, "distributionDomainName", { value: distribution.domainName, })
    new cdk.CfnOutput(this, "apiURL", { value: api.apiEndpoint, })
    new cdk.CfnOutput(this, "bucketName", { value: websiteBucket.bucketName, })
    
  }
}
