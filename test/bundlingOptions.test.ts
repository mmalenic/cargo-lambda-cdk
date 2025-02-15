import * as path from 'path';
import { env } from 'process';
import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { getManifestPath } from '../src/cargo';
import { RustFunction, RustFunctionProps, cargoLambdaVersion } from '../src/index';
import { bundlingOptionsFromRustFunctionProps } from '../src/util';

describe('bundlingOptionsFromRustFunctionProps', () => {
  describe('architecture', () => {
    it('uses `X86_64` when no props are given', () => {
      expect(bundlingOptionsFromRustFunctionProps().architecture).toEqual(lambda.Architecture.X86_64);
    });

    it('uses `X86_64` when no props regarding architecture are given', () => {
      expect(bundlingOptionsFromRustFunctionProps({ bundling: {} }).architecture).toEqual(lambda.Architecture.X86_64);
    });

    it('uses the `RustFunctionProps.architecture` when set', () => {
      expect(
        bundlingOptionsFromRustFunctionProps({
          architecture: lambda.Architecture.ARM_64,
        }).architecture,
      ).toEqual(lambda.Architecture.ARM_64);
    });

    it('uses the `BundlingOptions.architecture` when set', () => {
      expect(
        bundlingOptionsFromRustFunctionProps({
          bundling: { architecture: lambda.Architecture.ARM_64 },
        }).architecture,
      ).toEqual(lambda.Architecture.ARM_64);
    });

    it('throws an error when there is an architecture mismatch', () => {
      expect(
        () =>
          bundlingOptionsFromRustFunctionProps({
            architecture: lambda.Architecture.X86_64,
            bundling: { architecture: lambda.Architecture.ARM_64 },
          }).architecture,
      ).toThrow(
        "Architecture mismatch: the architecture for bundling (arm64 ) didn't match the architecture of the underlying lambda (x86_64).",
      );
    });
  });
});

// Integration tests

const forcedDockerBundling = !!env.FORCE_DOCKER_RUN || !cargoLambdaVersion();

const templateWithProps = (props?: RustFunctionProps) => {
  const app = new App();
  const stack = new Stack(app);
  const testSource = getManifestPath(path.join(__dirname, 'fixtures/single-package/Cargo.toml'));

  new RustFunction(stack, 'arm-64-set-via-lambda-architecture', { manifestPath: testSource, ...props });

  return Template.fromStack(stack);
};

describe('CargoLambda.RustFunction', () => {
  describe('Without an explicitly set lambda architecture', () => {
    const template = templateWithProps({
      bundling: {
        forcedDockerBundling,
      },
    });
    it('has a x86_64 lambda function', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        Architectures: ['x86_64'],
      });
    });
  });

  describe('With an explicitly set lambda architecture', () => {
    const template = templateWithProps({
      architecture: lambda.Architecture.ARM_64,
      bundling: {
        forcedDockerBundling,
      },
    });
    it('has a arm64 lambda function', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        Architectures: ['arm64'],
      });
    });
  });

  describe('With an explicitly set bundling architecture', () => {
    const template = templateWithProps({
      bundling: {
        architecture: lambda.Architecture.ARM_64,
        forcedDockerBundling,
      },
    });
    it('has a arm64 lambda function', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        Architectures: ['arm64'],
      });
    });
  });
});
