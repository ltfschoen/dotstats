import * as React from 'react';
import { Types } from '@dotstats/common';
import ReactSVG from 'react-svg';
import './Icon.css';

export interface Props {
  src: string;
  alt: string;
  className?: string;
  onClick?: () => void;
  nodeId?: Types.NodeId;
  nodeName?: Types.NodeName;
  isNodeNamePinned?: () => boolean;
};

export class Icon extends React.Component<{}, Props> {
  public props: Props;

  public shouldComponentUpdate(nextProps: any, nextState: any) {
    const { nodeName, isNodeNamePinned } = this.props;

    if (!nodeName || !nextProps.hasOwnProperty('isNodeNamePinned' || typeof nextProps.isNodeNamePinned === 'undefined')) {
      return false;
    }

    console.log('isNodeNamePinned vs nextProps.nodesPinned.get(nodeName)', isNodeNamePinned, nextProps.isNodeNamePinned, typeof nextProps.isNodeNamePinned === 'undefined');

    if (isNodeNamePinned !== nextProps.isNodeNamePinned) {
      return true;
    }

    return false;
  }

  public render() {
    const { alt, className, onClick, src, isNodeNamePinned } = this.props;

    return <ReactSVG title={alt} className={`${isNodeNamePinned ? 'IconPurple' : 'Icon'} ${ className || '' }`} path={src} onClick={onClick} />;
  }
}
